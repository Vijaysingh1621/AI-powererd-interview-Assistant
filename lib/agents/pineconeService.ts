import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { safePdfParse } from '../safePdfParse';

export interface PDFDocument {
  id: string;
  title: string;
  content: string;
  chunks: string[];
  metadata: {
    filename: string;
    uploadDate: string;
    pageCount: number;
    contentType: 'text' | 'multimodal';
  };
}

export interface SearchResult {
  content: string;
  score: number;
  metadata: any;
  source: string;
  contentType?: 'text' | 'image' | 'multimodal';
  page?: number;
  startPage?: number;
  endPage?: number;
}

class PineconeService {
  private pinecone: Pinecone | null = null;
  private gemini: GoogleGenerativeAI | null = null;
  private indexName: string;

  constructor() {
    this.indexName = process.env.PINECONE_INDEX_NAME || 'interview-docs';
    this.initialize();
  }

  private async initialize() {
    try {
      console.log('🔧 Initializing Pinecone service with Gemini embeddings...');
      
      if (process.env.PINECONE_API_KEY) {
        this.pinecone = new Pinecone({
          apiKey: process.env.PINECONE_API_KEY,
        });
        console.log('✅ Pinecone client initialized');
      } else {
        console.warn('⚠️ PINECONE_API_KEY not found - PDF search will be disabled');
      }

      if (process.env.GEMINI_API_KEY) {
        this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log('✅ Gemini client initialized for embeddings');
      } else {
        console.warn('⚠️ GEMINI_API_KEY not configured - PDF embeddings will be disabled');
        console.warn('   Please set a valid Gemini API key in your .env file');
      }
    } catch (error) {
      console.error('Failed to initialize Pinecone service:', error);
      
      // Log specific error details for debugging
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        console.error('🔍 File not found error during initialization:');
        console.error('   Path:', (error as any).path);
        console.error('   This might be a configuration or dependency issue.');
      }
    }
  }

  async uploadPDF(file: File): Promise<PDFDocument | null> {
    try {
      console.log('📄 Starting PDF upload:', file.name);
      
      if (!this.pinecone || !this.gemini) {
        console.error('❌ Pinecone or Gemini not initialized');
        throw new Error('Pinecone or Gemini not initialized');
      }

      // Validate file type and size
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('Only PDF files are supported');
      }
      
      if (file.size === 0) {
        throw new Error('File is empty');
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('File is too large (max 10MB)');
      }

      console.log('📖 Parsing PDF content...');
      // Parse PDF from the actual uploaded file buffer
      const arrayBuffer = await file.arrayBuffer();
      
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Invalid file buffer');
      }
      
      const buffer = Buffer.from(arrayBuffer);
      
      // Pass the buffer directly to pdf-parse
      const pdfData = await safePdfParse(buffer);
      
      if (!pdfData.text || pdfData.text.trim().length === 0) {
        throw new Error('No text content found in PDF');
      }
      
      console.log(`📊 PDF parsed: ${pdfData.numpages} pages, ${pdfData.text.length} characters`);

      // Split into chunks with page tracking (reduced size for Gemini token limits)
      const chunksWithPages = this.splitIntoChunksWithPages(pdfData, 150); // Further reduced from 200 to 150 words
      console.log(`🔗 Split into ${chunksWithPages.length} chunks with page tracking`);
      console.log(`⚠️ Using smaller chunks (150 words) to prevent Gemini token limit errors`);
      
      // Filter out chunks that are too short or mostly whitespace
      const validChunks = chunksWithPages.filter(chunk => {
        const cleanContent = chunk.content.trim().replace(/\s+/g, ' ');
        const wordCount = cleanContent.split(' ').length;
        const hasRealContent = /[a-zA-Z0-9]/.test(cleanContent);
        
        return cleanContent.length > 20 && wordCount > 5 && hasRealContent;
      });
      
      console.log(`✅ Filtered to ${validChunks.length} valid chunks (removed ${chunksWithPages.length - validChunks.length} empty/short chunks)`);
      
      // Generate embeddings and store
      const index = this.pinecone.index(this.indexName);
      const vectors = [];

      console.log('🧮 Generating embeddings...');
      let successfulEmbeddings = 0;
      let failedEmbeddings = 0;
      
      for (let i = 0; i < validChunks.length; i++) {
        const chunkData = validChunks[i];
        
        try {
          // Clean and validate chunk content
          const cleanContent = chunkData.content.trim().replace(/\s+/g, ' ');
          const wordCount = cleanContent.split(' ').length;
          const charCount = cleanContent.length;
          
          console.log(`   Processing chunk ${i + 1}/${validChunks.length} (${wordCount} words, ${charCount} chars)`);
          
          const embedding = await this.generateEmbedding(cleanContent);
          vectors.push({
            id: `${file.name}-chunk-${i}`,
            values: embedding,
            metadata: {
              content: cleanContent,
              filename: file.name,
              chunkIndex: i,
              title: file.name.replace('.pdf', ''),
              uploadDate: new Date().toISOString(),
              page: chunkData.page,
              startPage: chunkData.startPage,
              endPage: chunkData.endPage,
              wordCount: wordCount,
              charCount: charCount,
            }
          });
          successfulEmbeddings++;
          
          // Add delay to avoid rate limiting (increased delay)
          if (i > 0 && i % 3 === 0) {
            console.log(`   Processed ${i} chunks, pausing to avoid rate limits...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Increased from 1s to 2s
          }
          
        } catch (embeddingError) {
          console.error(`❌ Failed to generate embedding for chunk ${i}:`, embeddingError);
          failedEmbeddings++;
          
          // If it's a token limit error, log specific details
          if (embeddingError instanceof Error && (embeddingError.message.includes('token') || embeddingError.message.includes('limit'))) {
            console.error(`🔍 Token/limit error for chunk ${i}:`);
            console.error(`   Content length: ${chunkData.content.length} characters`);
            console.error(`   Word count: ${chunkData.content.split(' ').length} words`);
            console.error(`   This suggests we need even smaller chunks or better text cleaning.`);
          }
        }
      }
      
      console.log(`📊 Embedding Results: ${successfulEmbeddings} successful, ${failedEmbeddings} failed`);
      
      if (vectors.length === 0) {
        throw new Error(`No embeddings were generated successfully. This might be due to token limits or API issues.`);
      }

      console.log('💾 Storing vectors in Pinecone...');
      await index.upsert(vectors);
      
      console.log('✅ PDF upload completed successfully');

      return {
        id: file.name,
        title: file.name.replace('.pdf', ''),
        content: pdfData.text,
        chunks: chunksWithPages.map(c => c.content),
        metadata: {
          filename: file.name,
          uploadDate: new Date().toISOString(),
          pageCount: pdfData.numpages || 0,
          contentType: 'text' as const,
        }
      };
    } catch (error) {
      console.error('❌ Error uploading PDF:', error);
      
      // Enhanced error handling for common issues
      if (error instanceof Error) {
        if (error.message.includes('PineconeNotFoundError') || error.message.includes('404')) {
          console.error('🔍 Pinecone Index Not Found:');
          console.error('   The Pinecone index does not exist.');
          console.error('   Please run: yarn setup-pinecone');
          console.error('   This will create the required index with correct specifications.');
        } else if (error.message.includes('401') || error.message.includes('authentication')) {
          console.error('🔑 Authentication Error:');
          console.error('   Please check your PINECONE_API_KEY in .env.local');
        } else if (error.message.includes('quota') || error.message.includes('limit')) {
          console.error('📊 Quota/Limit Error:');
          console.error('   You may have reached your Pinecone plan limits.');
          console.error('   Check your usage at: https://app.pinecone.io/');
        } else if ('code' in error && error.code === 'ENOENT') {
          console.error('🔍 File not found error in PDF upload:');
          console.error('   Path:', (error as any).path);
          console.error('   This suggests a missing file reference in the pdf-parse library or related code.');
          console.error('   Make sure no hardcoded file paths are being used.');
        }
      }
      
      return null;
    }
  }

  async searchSimilarContent(query: string, topK: number = 5): Promise<SearchResult[]> {
    try {
      console.log('🔍 Searching for similar content:', query);
      
      if (!this.pinecone || !this.gemini) {
        console.warn('⚠️ Pinecone or Gemini not initialized');
        return [];
      }

      console.log('🧮 Generating query embedding...');
      const queryEmbedding = await this.generateEmbedding(query);
      const index = this.pinecone.index(this.indexName);

      console.log('🔎 Querying Pinecone index...');
      const searchResponse = await index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
      });

      console.log('📊 Pinecone search response:');
      console.log('   Matches found:', searchResponse.matches?.length || 0);
      
      if (searchResponse.matches && searchResponse.matches.length > 0) {
        console.log('📄 Search results details:');
        searchResponse.matches.forEach((match, index) => {
          console.log(`   ${index + 1}. Score: ${match.score?.toFixed(3)}, ID: ${match.id}`);
          console.log(`      Content: ${(match.metadata?.content as string)?.substring(0, 100)}...`);
          console.log(`      Filename: ${match.metadata?.filename}`);
          console.log(`      Page: ${match.metadata?.page}`);
        });
      } else {
        console.warn('⚠️ No matches found in Pinecone search');
        console.log('   This could mean:');
        console.log('   - No PDFs have been uploaded yet');
        console.log('   - The query doesn\'t match any content');
        console.log('   - The similarity scores are too low');
        
        // Let's try to get some stats about the index
        try {
          const stats = await index.describeIndexStats();
          console.log('📈 Index stats:', stats);
        } catch (statsError) {
          console.log('   Could not retrieve index stats');
        }
      }

      const results = searchResponse.matches?.map(match => ({
        content: match.metadata?.content as string || '',
        score: match.score || 0,
        metadata: match.metadata,
        source: `PDF: ${match.metadata?.filename || 'Unknown'}`,
        page: typeof match.metadata?.page === 'number' ? match.metadata.page : 1,
        startPage: typeof match.metadata?.startPage === 'number' ? match.metadata.startPage : 1,
        endPage: typeof match.metadata?.endPage === 'number' ? match.metadata.endPage : 1
      })) || [];
      
      console.log(`✅ Search completed: ${results.length} results found`);
      return results;
      
    } catch (error) {
      console.error('❌ Error searching Pinecone:', error);
      
      // Enhanced error handling for search operations
      if (error instanceof Error) {
        if (error.message.includes('PineconeNotFoundError') || error.message.includes('404')) {
          console.error('🔍 Pinecone Index Not Found:');
          console.error('   The Pinecone index does not exist for search.');
          console.error('   Please run: yarn setup-pinecone');
        } else if (error.message.includes('401') || error.message.includes('authentication')) {
          console.error('🔑 Authentication Error:');
          console.error('   Please check your PINECONE_API_KEY in .env.local');
        } else if ('code' in error && error.code === 'ENOENT') {
          console.error('🔍 File not found error in Pinecone search:');
          console.error('   Path:', (error as any).path);
          console.error('   This suggests a missing file reference in the search process.');
        }
      }
      
      return [];
    }
  }

  private async generateEmbedding(text: string, contentType: 'text' | 'multimodal' = 'text'): Promise<number[]> {
    if (!this.gemini) {
      throw new Error('Gemini not initialized');
    }

    try {
      // Clean and prepare text
      const cleanedText = text.trim().replace(/\s+/g, ' ');
      const charCount = cleanedText.length;
      const wordCount = cleanedText.split(' ').length;
      
      console.log(`🧮 Generating ${contentType} embedding using Gemini...`);
      console.log(`   Text stats: ${wordCount} words, ${charCount} characters`);
      
      // Conservative token limit for Gemini (approximately 1 token = 4 characters)
      const maxChars = 1500; // Conservative limit well below Gemini's actual limit
      const maxWords = 300;   // Additional word-based limit
      
      let processedText = cleanedText;
      
      // Apply both character and word limits
      if (charCount > maxChars || wordCount > maxWords) {
        console.warn(`⚠️ Text exceeds limits (${charCount} chars, ${wordCount} words), truncating...`);
        
        // Truncate by words first (more natural)
        const words = cleanedText.split(' ');
        if (words.length > maxWords) {
          processedText = words.slice(0, maxWords).join(' ');
        }
        
        // Then by characters if still too long
        if (processedText.length > maxChars) {
          processedText = processedText.substring(0, maxChars);
        }
        
        // Ensure we end on a complete word
        const lastSpaceIndex = processedText.lastIndexOf(' ');
        if (lastSpaceIndex > maxChars * 0.8) { // Only trim if we're not losing too much
          processedText = processedText.substring(0, lastSpaceIndex);
        }
        
        console.log(`   Truncated to: ${processedText.split(' ').length} words, ${processedText.length} characters`);
      }
      
      // Additional validation
      if (processedText.length < 10) {
        console.warn('⚠️ Text too short after processing, using fallback...');
        throw new Error('Text too short for meaningful embedding');
      }
      
      // Use Gemini's text embedding model
      const model = this.gemini.getGenerativeModel({ 
        model: 'text-embedding-004' // Gemini's latest embedding model
      });

      const result = await model.embedContent(processedText);
      
      if (!result.embedding || !result.embedding.values) {
        throw new Error('Invalid embedding response from Gemini');
      }

      console.log(`✅ Generated embedding with ${result.embedding.values.length} dimensions`);
      return result.embedding.values;
      
    } catch (error) {
      console.error('❌ Error generating Gemini embedding:', error);
      
      // Enhanced error handling for Gemini API issues
      if (error instanceof Error) {
        if (error.message.includes('API_KEY_INVALID') || error.message.includes('API key not valid')) {
          console.error('🔑 Invalid Gemini API Key:');
          console.error('   Your GEMINI_API_KEY in .env.local is not valid.');
          console.error('   Please get a valid API key from: https://makersuite.google.com/app/apikey');
          console.error('   Make sure to replace the placeholder value in .env.local');
        } else if (error.message.includes('400') || error.message.includes('Bad Request')) {
          console.error('🚫 Gemini API Request Error:');
          console.error('   Please check your API key and request parameters.');
          console.error('   Text length:', text.length, 'characters');
        } else if (error.message.includes('quota') || error.message.includes('limit') || error.message.includes('429')) {
          console.error('📊 Gemini API Quota/Rate Limit Error:');
          console.error('   You may have exceeded your API usage limits or rate limits.');
          console.error('   Check your usage at: https://makersuite.google.com/');
          console.error('   Consider adding delays between requests or reducing chunk sizes.');
        } else if (error.message.includes('token') || error.message.includes('length')) {
          console.error('📏 Token Length Error:');
          console.error('   Input text may be too long for Gemini API.');
          console.error('   Current text length:', text.length, 'characters');
          console.error('   Consider reducing chunk sizes further.');
        }
      }
      
      // Don't create fallback embeddings for production - let the error bubble up
      // so we can handle chunking issues properly
      throw error;
    }
  }

  // Enhanced method for multimodal content (images + text)
  private async generateMultimodalEmbedding(
    text: string, 
    imageData?: ArrayBuffer
  ): Promise<number[]> {
    if (!this.gemini) {
      throw new Error('Gemini not initialized');
    }

    try {
      console.log('🖼️ Generating multimodal embedding (text + image)...');
      
      const model = this.gemini.getGenerativeModel({ 
        model: 'gemini-1.5-pro' // Supports multimodal
      });

      let content: any[] = [{ text }];

      // Add image data if provided
      if (imageData) {
        content.push({
          inlineData: {
            data: Buffer.from(imageData).toString('base64'),
            mimeType: 'image/jpeg'
          }
        });
      }

      // Generate text representation first, then embed it
      const response = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: 'Describe this content in detail for semantic search purposes:' },
            ...content
          ]
        }]
      });

      const description = response.response.text();
      
      // Now generate embedding from the description
      return await this.generateEmbedding(description, 'multimodal');
      
    } catch (error) {
      console.error('Error generating multimodal embedding:', error);
      // Fallback to text-only embedding
      return await this.generateEmbedding(text, 'text');
    }
  }

  private splitIntoChunks(text: string, chunkSize: number): string[] {
    const words = text.split(' ');
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '));
    }
    
    return chunks;
  }

  private splitIntoChunksWithPages(pdfData: any, chunkSize: number): Array<{content: string, page: number, startPage: number, endPage: number}> {
    const text = pdfData.text;
    
    // Clean the text first - remove excessive whitespace and newlines
    const cleanedText = text
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
      .replace(/\s{3,}/g, ' ')     // Replace 3+ spaces with 1
      .trim();
    
    console.log(`📝 Text cleaning: ${text.length} -> ${cleanedText.length} characters`);
    
    // Split by sentences first, then by words if needed
    const sentences = cleanedText.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
    const chunks: Array<{content: string, page: number, startPage: number, endPage: number}> = [];
    
    // Estimate pages based on character count (approximate)
    const avgCharsPerPage = Math.ceil(cleanedText.length / (pdfData.numpages || 1));
    
    let currentChunk = '';
    let currentWordCount = 0;
    let chunkStartPos = 0;
    
    for (const sentence of sentences) {
      const sentenceWords = sentence.trim().split(' ').length;
      const sentenceText = sentence.trim() + '. ';
      
      // If adding this sentence would exceed chunk size, finalize current chunk
      if (currentWordCount + sentenceWords > chunkSize && currentChunk.length > 0) {
        // Calculate page information for current chunk
        const chunkEnd = chunkStartPos + currentChunk.length;
        const startPage = Math.max(1, Math.ceil(chunkStartPos / avgCharsPerPage));
        const endPage = Math.min(pdfData.numpages || 1, Math.ceil(chunkEnd / avgCharsPerPage));
        const page = startPage;
        
        chunks.push({
          content: currentChunk.trim(),
          page,
          startPage,
          endPage
        });
        
        // Start new chunk
        chunkStartPos = chunkEnd;
        currentChunk = sentenceText;
        currentWordCount = sentenceWords;
      } else {
        // Add sentence to current chunk
        currentChunk += sentenceText;
        currentWordCount += sentenceWords;
      }
    }
    
    // Add final chunk if it has content
    if (currentChunk.trim().length > 0) {
      const chunkEnd = chunkStartPos + currentChunk.length;
      const startPage = Math.max(1, Math.ceil(chunkStartPos / avgCharsPerPage));
      const endPage = Math.min(pdfData.numpages || 1, Math.ceil(chunkEnd / avgCharsPerPage));
      const page = startPage;
      
      chunks.push({
        content: currentChunk.trim(),
        page,
        startPage,
        endPage
      });
    }
    
    console.log(`🔗 Created ${chunks.length} sentence-based chunks`);
    return chunks;
  }

  async deleteDocument(filename: string): Promise<boolean> {
    try {
      if (!this.pinecone) {
        return false;
      }

      const index = this.pinecone.index(this.indexName);
      
      // Find all chunks for this document
      const searchResponse = await index.query({
        vector: new Array(768).fill(0), // Gemini text-embedding-004 dimensions
        topK: 10000,
        includeMetadata: true,
        filter: { filename: { $eq: filename } }
      });

      if (searchResponse.matches && searchResponse.matches.length > 0) {
        const idsToDelete = searchResponse.matches.map(match => match.id);
        await index.deleteMany(idsToDelete);
      }

      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      return false;
    }
  }
}

export const pineconeService = new PineconeService();
