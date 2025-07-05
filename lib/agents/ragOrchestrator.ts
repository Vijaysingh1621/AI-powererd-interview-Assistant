import { extractQuestionFromTranscript, ExtractedQuestion } from './questionExtractor';
import { extractQuestionLocally, generateSearchQuery } from './localQuestionExtractor';
import { pineconeService, SearchResult } from './pineconeService';
import { webSearchAgent, WebSearchResult } from './simpleWebSearchAgent';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface RAGContext {
  pdfResults: SearchResult[];
  webResults: WebSearchResult[];
  combinedContext: string;
  citations: Citation[];
}

export interface Citation {
  source: string;
  content: string;
  url?: string;
  score: number;
  page?: number;
  startPage?: number;
  endPage?: number;
  filename?: string;
  sourceType: 'pdf' | 'web';
  contextSnippet?: string;
  pageRange?: string;
  contentType?: 'text' | 'image' | 'multimodal';
}

export interface RAGResponse {
  extractedQuestion: ExtractedQuestion | null;
  context: RAGContext;
  searchPerformed: boolean;
}

class RAGOrchestrator {
  private gemini: GoogleGenerativeAI | null = null;

  constructor() {
    this.initializeGemini();
  }

  private async initializeGemini() {
    try {
      if (process.env.GEMINI_API_KEY) {
        this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log('✅ Gemini initialized for multimodal processing');
      } else {
        console.warn('⚠️ GEMINI_API_KEY not found - multimodal features will be limited');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Gemini:', error);
    }
  }

  async processTranscript(transcript: string, background?: string): Promise<RAGResponse> {
    try {
      console.log('🔍 Extracting question from transcript...');
      
      // Step 1: Try to extract question from transcript
      let extractedQuestion: ExtractedQuestion | null = null;
      try {
        extractedQuestion = await extractQuestionFromTranscript(transcript);
        if (extractedQuestion && extractedQuestion.confidence >= 0.4) {
          console.log('✅ Question extracted:', extractedQuestion.question);
        } else {
          console.log('⚠️ Low confidence question extraction, using fallback');
          extractedQuestion = null;
        }
      } catch (error) {
        console.warn('⚠️ Question extraction failed (quota/API issue), trying local extraction:', (error as Error).message || 'Unknown error');
        
        // Try local question extraction as fallback
        const localQuestion = extractQuestionLocally(transcript);
        if (localQuestion && localQuestion.confidence >= 0.5) {
          console.log('✅ Local question extraction successful:', localQuestion.question);
          extractedQuestion = {
            question: localQuestion.question,
            context: localQuestion.context,
            confidence: localQuestion.confidence
          };
        } else {
          console.log('⚠️ Local question extraction also failed, will use search query generation');
          extractedQuestion = null;
        }
      }

      // Determine search query - use extracted question or fallback to transcript
      let searchQuery = '';
      if (extractedQuestion && extractedQuestion.question) {
        searchQuery = extractedQuestion.question;
      } else {
        // Fallback: generate search query from transcript
        searchQuery = generateSearchQuery(transcript);
        console.log('🔄 Using generated search query:', searchQuery);
      }

      // If we still don't have a meaningful query, skip RAG
      if (!searchQuery || searchQuery.length < 10) {
        console.log('❌ No meaningful search query found');
        return {
          extractedQuestion: null,
          context: {
            pdfResults: [],
            webResults: [],
            combinedContext: '',
            citations: []
          },
          searchPerformed: false
        };
      }

      // Step 2: Search PDF documents (parallel) - with error handling
      console.log('🔍 Starting PDF search with query:', searchQuery);
      const pdfSearchPromise = this.searchPDFs(searchQuery)
        .catch(error => {
          console.error('PDF search error:', error);
          return [];
        });
      
      // Step 3: Search web (parallel) - with error handling
      console.log('🔍 Starting web search...');
      const webSearchPromise = this.searchWeb(searchQuery, background)
        .catch(error => {
          console.error('Web search error:', error);
          return { results: [] };
        });
      
      console.log('🚀 Both search promises created, waiting for results...');
      
      // Wait for both searches to complete
      console.log('⏳ Waiting for search results...');
      const [pdfResults, webSearchResponse] = await Promise.all([
        pdfSearchPromise,
        webSearchPromise
      ]);

      console.log('🎯 Promise.all completed successfully');
      console.log(`📄 Found ${pdfResults.length} PDF results`);
      console.log(`🌐 Found ${webSearchResponse.results.length} web results`);
      
      if (webSearchResponse.results.length === 0) {
        console.warn('⚠️ Web search returned 0 results - investigating...');
        console.log('🔍 Web search response object:', webSearchResponse);
      }
      
      // Step 4: Combine and rank results
      const context = this.combineContexts(pdfResults, webSearchResponse.results);
      
      return {
        extractedQuestion,
        context,
        searchPerformed: true
      };
      
    } catch (error) {
      console.error('Error in RAG processing:', error);
      
      // Log specific error details for debugging
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        console.error('🔍 File not found error in RAG processing:');
        console.error('   Path:', (error as any).path);
        console.error('   This might be a hardcoded test file reference or missing dependency.');
      }
      
      return {
        extractedQuestion: null,
        context: {
          pdfResults: [],
          webResults: [],
          combinedContext: '',
          citations: []
        },
        searchPerformed: false
      };
    }
  }

  private async searchPDFs(question: string): Promise<SearchResult[]> {
    try {
      console.log('🔍 Searching PDFs with question:', question);
      const results = await pineconeService.searchSimilarContent(question, 3);
      console.log(`📄 PDF search completed: ${results.length} results found`);
      return results;
    } catch (error) {
      console.error('Error searching PDFs:', error);
      
      // Log specific error details for debugging
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        console.error('🔍 File not found error in PDF search:');
        console.error('   Path:', (error as any).path);
        console.error('   This might be a hardcoded test file reference.');
      }
      
      return [];
    }
  }

  private async searchWeb(question: string, background?: string): Promise<{ results: WebSearchResult[] }> {
    try {
      console.log('🌐 WebSearch method called with:', { question, background });
      
      // Enhance question with background context if available
      let searchQuery = question;
      if (background) {
        const backgroundKeywords = this.extractKeywords(background);
        if (backgroundKeywords.length > 0) {
          searchQuery = `${question} ${backgroundKeywords.slice(0, 3).join(' ')}`;
        }
      }

      console.log('🔍 Enhanced search query:', searchQuery);
      console.log('🔧 Calling webSearchAgent.searchWeb...');
      
      const webResponse = await webSearchAgent.searchWeb(searchQuery, 3);
      
      console.log('✅ Web search response received:', {
        resultsCount: webResponse.results.length,
        totalResults: webResponse.totalResults,
        searchQuery: webResponse.searchQuery
      });
      
      return { results: webResponse.results };
    } catch (error) {
      console.error('❌ Error in searchWeb method:', error);
      return { results: [] };
    }
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Remove common words
    const stopWords = new Set(['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'about']);
    
    return words.filter(word => !stopWords.has(word)).slice(0, 5);
  }

  private combineContexts(pdfResults: SearchResult[], webResults: WebSearchResult[]): RAGContext {
    console.log('🔗 Combining contexts...');
    console.log(`📄 PDF results: ${pdfResults.length}`);
    console.log(`🌐 Web results: ${webResults.length}`);
    
    // Log web results details
    if (webResults.length > 0) {
      console.log('🌐 Web results details:');
      webResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.title} (Score: ${result.score})`);
        console.log(`     URL: ${result.link}`);
        console.log(`     Snippet: ${result.snippet.substring(0, 100)}...`);
      });
    } else {
      console.warn('⚠️ No web results to combine');
    }

    // Log PDF results details
    if (pdfResults.length > 0) {
      console.log('📄 PDF results details:');
      pdfResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.source} (Score: ${result.score})`);
        if (result.page) {
          console.log(`     Page: ${result.page}`);
        }
        if (result.startPage && result.endPage && result.startPage !== result.endPage) {
          console.log(`     Page Range: ${result.startPage}-${result.endPage}`);
        }
        console.log(`     Content: ${result.content.substring(0, 100)}...`);
      });
    } else {
      console.log('📄 No PDF results found');
    }
    
    // Prioritize PDF results over web results for better accuracy
    const allResults = [
      ...pdfResults.map(r => ({ ...r, type: 'pdf', priority: 1 })),
      ...webResults.map(r => ({ ...r, content: r.snippet, type: 'web', priority: 2 }))
    ];

    console.log(`🔗 Total combined results: ${allResults.length}`);

    // Sort by priority first (PDF > Web), then by relevance score
    allResults.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.score - a.score;
    });

    // Take top 4 results (prioritize PDFs)
    const topResults = allResults.slice(0, 4);
    console.log(`🏆 Top results selected: ${topResults.length}`);

    // Build combined context with clear source labeling
    const contextParts: string[] = [];
    const citations: Citation[] = [];

    topResults.forEach((result, index) => {
      const content = result.content.substring(0, 500); // Increased length for better context
      const sourceType = result.type === 'pdf' ? '[PDF]' : '[WEB]';
      const isPdf = result.type === 'pdf';
      
      // Enhanced context with page information for PDFs
      let contextInfo = '';
      if (isPdf) {
        const pageInfo = this.formatPageInfo(result);
        contextInfo = `${sourceType} ${pageInfo ? `(${pageInfo}) ` : ''}${content}`;
      } else {
        contextInfo = `${sourceType} ${content}`;
      }
      
      contextParts.push(contextInfo);
      
      // Create detailed citation with enhanced information
      const citation: Citation = {
        source: result.source,
        content: content,
        url: !isPdf ? (result as any).link : undefined,
        score: result.score,
        sourceType: (result.type as 'pdf' | 'web'),
        page: isPdf ? (result as any).page : undefined,
        startPage: isPdf ? (result as any).startPage : undefined,
        endPage: isPdf ? (result as any).endPage : undefined,
        filename: isPdf ? (result as any).metadata?.filename || result.source : undefined,
        pageRange: isPdf ? this.formatPageInfo(result) : undefined,
        contextSnippet: content.substring(0, 150) + (content.length > 150 ? '...' : '')
      };
      
      citations.push(citation);
    });

    const finalContext = {
      pdfResults: pdfResults,
      webResults: webResults,
      combinedContext: contextParts.join('\n\n'),
      citations: citations
    };
    
    console.log(`✅ Context combination complete. Combined context length: ${finalContext.combinedContext.length}`);
    
    return finalContext;
  }

  /**
   * Extract a fallback search query from transcript when question extraction fails
   */
  private extractFallbackQuery(transcript: string): string {
    // Simple pattern matching for common question structures
    const questionPatterns = [
      /(?:asked about|asking about|question about|tell me about|explain about)\s+([^.?!]+)/i,
      /(?:what is|what are|how do|how to|why is|why are|when is|when are|where is|where are)\s+([^.?!]+)/i,
      /(?:can you|could you|would you)\s+(?:explain|tell|describe|help)\s+([^.?!]+)/i,
      /(?:I need to know|I want to know|I should know)\s+(?:about\s+)?([^.?!]+)/i
    ];

    for (const pattern of questionPatterns) {
      const match = transcript.match(pattern);
      if (match && match[1]) {
        const query = match[1].trim();
        if (query.length > 5) {
          return query;
        }
      }
    }

    // If no patterns match, extract key terms from the transcript
    const words = transcript.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['that', 'this', 'with', 'from', 'they', 'have', 'were', 'been', 'said', 'what', 'when', 'where', 'could', 'would', 'should'].includes(word));

    // Take the first 5 meaningful words as search query
    return words.slice(0, 5).join(' ');
  }

  // Utility method for uploading PDFs
  async uploadPDF(file: File): Promise<boolean> {
    try {
      const result = await pineconeService.uploadPDF(file);
      return result !== null;
    } catch (error) {
      console.error('Error uploading PDF:', error);
      return false;
    }
  }

  // Utility method for deleting PDFs
  async deletePDF(filename: string): Promise<boolean> {
    try {
      return await pineconeService.deleteDocument(filename);
    } catch (error) {
      console.error('Error deleting PDF:', error);
      return false;
    }
  }

  /**
   * Format page information for display
   */
  private formatPageInfo(result: any): string {
    if (!result || result.type !== 'pdf') return '';
    
    const page = result.page;
    const startPage = result.startPage;
    const endPage = result.endPage;
    
    if (startPage && endPage && startPage !== endPage) {
      return `Pages ${startPage}-${endPage}`;
    } else if (page) {
      return `Page ${page}`;
    } else if (startPage) {
      return `Page ${startPage}`;
    }
    
    return '';
  }

  /**
   * Generate a detailed context summary with source information
   */
  generateContextSummary(context: RAGContext): string {
    if (!context.citations || context.citations.length === 0) {
      return 'No sources found for this query.';
    }

    let summary = '\n📚 **Sources Found:**\n\n';
    
    context.citations.forEach((citation, index) => {
      const sourceNumber = index + 1;
      summary += `**Source ${sourceNumber}** (Relevance: ${(citation.score * 100).toFixed(1)}%)\n`;
      
      if (citation.sourceType === 'pdf') {
        summary += `📄 **Document:** ${citation.filename || citation.source}\n`;
        if (citation.pageRange) {
          summary += `📖 **Location:** ${citation.pageRange}\n`;
        }
        summary += `💬 **Context:** "${citation.contextSnippet}"\n`;
      } else {
        summary += `🌐 **Website:** ${citation.source}\n`;
        if (citation.url) {
          summary += `🔗 **Link:** ${citation.url}\n`;
        }
        summary += `💬 **Snippet:** "${citation.contextSnippet}"\n`;
      }
      
      summary += '\n';
    });

    return summary;
  }

  /**
   * Get formatted context with numbered source references
   */
  getFormattedContextWithReferences(context: RAGContext): { 
    formattedContext: string; 
    sourceReferences: string 
  } {
    if (!context.citations || context.citations.length === 0) {
      return {
        formattedContext: context.combinedContext,
        sourceReferences: 'No sources available.'
      };
    }

    let formattedContext = '';
    let sourceReferences = '\n**📚 Source References:**\n\n';
    
    context.citations.forEach((citation, index) => {
      const sourceNumber = index + 1;
      
      // Add content with source reference
      if (citation.sourceType === 'pdf') {
        const pageInfo = citation.pageRange || (citation.page ? `Page ${citation.page}` : '');
        formattedContext += `[${sourceNumber}] ${citation.content}\n\n`;
        
        sourceReferences += `[${sourceNumber}] **${citation.filename || citation.source}**`;
        if (pageInfo) {
          sourceReferences += ` - ${pageInfo}`;
        }
        sourceReferences += ` (Relevance: ${(citation.score * 100).toFixed(1)}%)\n`;
      } else {
        formattedContext += `[${sourceNumber}] ${citation.content}\n\n`;
        
        sourceReferences += `[${sourceNumber}] **${citation.source}**`;
        if (citation.url) {
          sourceReferences += ` - [View Source](${citation.url})`;
        }
        sourceReferences += ` (Relevance: ${(citation.score * 100).toFixed(1)}%)\n`;
      }
    });

    return { formattedContext: formattedContext.trim(), sourceReferences };
  }

  /**
   * Process multimodal query (text + optional image)
   */
  async processMultimodalTranscript(
    transcript: string, 
    imageFile?: File, 
    background?: string
  ): Promise<RAGResponse> {
    try {
      console.log('🖼️ Processing multimodal transcript...');
      
      // Step 1: Extract question from text (same as before)
      let extractedQuestion: ExtractedQuestion | null = null;
      try {
        extractedQuestion = await extractQuestionFromTranscript(transcript);
        if (extractedQuestion && extractedQuestion.confidence >= 0.4) {
          console.log('✅ Question extracted:', extractedQuestion.question);
        } else {
          console.log('⚠️ Low confidence question extraction, using fallback');
          extractedQuestion = null;
        }
      } catch (error) {
        console.warn('⚠️ Question extraction failed (quota/API issue), trying local extraction:', (error as Error).message || 'Unknown error');
        
        // Try local question extraction as fallback
        const localQuestion = extractQuestionLocally(transcript);
        if (localQuestion && localQuestion.confidence >= 0.5) {
          console.log('✅ Local question extraction successful:', localQuestion.question);
          extractedQuestion = {
            question: localQuestion.question,
            context: localQuestion.context,
            confidence: localQuestion.confidence
          };
        } else {
          console.log('⚠️ Local question extraction also failed, will use search query generation');
          extractedQuestion = null;
        }
      }

      // Step 2: Process image if provided
      let imageContext = '';
      if (imageFile) {
        console.log('🖼️ Processing uploaded image...');
        imageContext = await this.processImageForContext(imageFile);
      }

      // Step 3: Create enhanced search query combining text and image context
      let searchQuery = '';
      if (extractedQuestion && extractedQuestion.question) {
        searchQuery = extractedQuestion.question;
        if (imageContext) {
          searchQuery += ` ${imageContext}`;
        }
      } else {
        searchQuery = generateSearchQuery(transcript);
        if (imageContext) {
          searchQuery += ` ${imageContext}`;
        }
      }

      // Step 4: Multimodal search (both text and visual similarity)
      const pdfSearchPromise = this.searchMultimodalPDFs(searchQuery, imageFile);
      const webSearchPromise = this.searchWeb(searchQuery, background);
      
      const [pdfResults, webSearchResponse] = await Promise.all([
        pdfSearchPromise.catch(error => {
          console.error('Multimodal PDF search error:', error);
          return [];
        }),
        webSearchPromise.catch(error => {
          console.error('Web search error:', error);
          return { results: [] };
        })
      ]);

      // Step 5: Combine results with multimodal context
      const context = this.combineMultimodalContexts(pdfResults, webSearchResponse.results);
      
      return {
        extractedQuestion,
        context,
        searchPerformed: true
      };
      
    } catch (error) {
      console.error('Error in multimodal RAG processing:', error);
      return {
        extractedQuestion: null,
        context: {
          pdfResults: [],
          webResults: [],
          combinedContext: '',
          citations: []
        },
        searchPerformed: false
      };
    }
  }

  /**
   * Process uploaded image to extract context for search
   */
  private async processImageForContext(imageFile: File): Promise<string> {
    try {
      const arrayBuffer = await imageFile.arrayBuffer();
      
      // Use Gemini to analyze the image and extract searchable context
      if (!this.gemini) {
        throw new Error('Gemini not initialized for image processing');
      }

      const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-pro' });
      
      const result = await model.generateContent([
        { text: "Analyze this image and describe what you see. Focus on text content, diagrams, charts, and any technical information that would be useful for semantic search." },
        {
          inlineData: {
            data: Buffer.from(arrayBuffer).toString('base64'),
            mimeType: imageFile.type
          }
        }
      ]);

      const description = result.response.text();
      console.log('🖼️ Image analysis result:', description.substring(0, 200) + '...');
      
      return description;
    } catch (error) {
      console.error('Error processing image for context:', error);
      return '';
    }
  }

  /**
   * Search PDFs with multimodal capabilities
   */
  private async searchMultimodalPDFs(query: string, imageFile?: File): Promise<SearchResult[]> {
    try {
      console.log('🔍🖼️ Performing multimodal PDF search...');
      
      // For now, use text-based search
      // In a full implementation, this would also search image content within PDFs
      const textResults = await pineconeService.searchSimilarContent(query, 3);
      
      // TODO: Add visual similarity search for images within PDFs
      // This would require:
      // 1. Extracting images from PDFs during upload
      // 2. Generating image embeddings
      // 3. Storing image embeddings with page references
      // 4. Performing visual similarity search
      
      return textResults;
    } catch (error) {
      console.error('Error in multimodal PDF search:', error);
      return [];
    }
  }

  /**
   * Combine multimodal contexts with enhanced metadata
   */
  private combineMultimodalContexts(pdfResults: SearchResult[], webResults: WebSearchResult[]): RAGContext {
    console.log('🔗🖼️ Combining multimodal contexts...');
    
    // Enhanced combination that considers content types
    const allResults = [
      ...pdfResults.map(r => ({ 
        ...r, 
        type: 'pdf', 
        priority: r.contentType === 'multimodal' ? 0.5 : 1,  // Prioritize multimodal content
        isMultimodal: r.contentType === 'multimodal'
      })),
      ...webResults.map(r => ({ 
        ...r, 
        content: r.snippet, 
        type: 'web', 
        priority: 2,
        isMultimodal: false
      }))
    ];

    // Sort by priority (multimodal > PDF > Web), then by relevance
    allResults.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.score - a.score;
    });

    const topResults = allResults.slice(0, 4);
    const contextParts: string[] = [];
    const citations: Citation[] = [];

    topResults.forEach((result, index) => {
      const content = result.content.substring(0, 500);
      const sourceType = result.type === 'pdf' ? 
        (result.isMultimodal ? '[PDF+IMG]' : '[PDF]') : 
        '[WEB]';
      
      const isPdf = result.type === 'pdf';
      
      let contextInfo = '';
      if (isPdf) {
        const pageInfo = this.formatPageInfo(result);
        const modalityInfo = result.isMultimodal ? ' (contains images)' : '';
        contextInfo = `${sourceType}${modalityInfo} ${pageInfo ? `(${pageInfo}) ` : ''}${content}`;
      } else {
        contextInfo = `${sourceType} ${content}`;
      }
      
      contextParts.push(contextInfo);
      
      const citation: Citation = {
        source: result.source,
        content: content,
        url: !isPdf ? (result as any).link : undefined,
        score: result.score,
        sourceType: (result.type as 'pdf' | 'web'),
        page: isPdf ? (result as any).page : undefined,
        startPage: isPdf ? (result as any).startPage : undefined,
        endPage: isPdf ? (result as any).endPage : undefined,
        filename: isPdf ? (result as any).metadata?.filename || result.source : undefined,
        pageRange: isPdf ? this.formatPageInfo(result) : undefined,
        contextSnippet: content.substring(0, 150) + (content.length > 150 ? '...' : ''),
        // Add multimodal indicator
        contentType: result.isMultimodal ? 'multimodal' : 'text'
      };
      
      citations.push(citation);
    });

    return {
      pdfResults: pdfResults,
      webResults: webResults,
      combinedContext: contextParts.join('\n\n'),
      citations: citations
    };
  }
}

export const ragOrchestrator = new RAGOrchestrator();
