// Simple working web search agent
export interface WebSearchResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
  score: number;
}

export interface SearchResponse {
  results: WebSearchResult[];
  searchQuery: string;
  totalResults: number;
}

class SimpleWebSearchAgent {
  private tavilyApiKey: string;

  constructor() {
    this.tavilyApiKey = process.env.TAVILY_API_KEY || '';
    console.log('🔧 SimpleWebSearchAgent initialized');
  }

  async searchWeb(query: string, numResults: number = 5): Promise<SearchResponse> {
    console.log('🌐 SimpleWebSearchAgent.searchWeb called');
    console.log('🔍 Query:', query);
    
    try {
      if (!this.tavilyApiKey) {
        console.warn('⚠️ TAVILY_API_KEY not configured - returning fallback');
        return {
          results: [{
            title: `Search: ${query}`,
            link: 'https://example.com',
            snippet: `Fallback result for: ${query}. Please configure TAVILY_API_KEY.`,
            source: 'Web: Fallback',
            score: 0.5
          }],
          searchQuery: query,
          totalResults: 1
        };
      }

      // Dynamic import of Tavily
      const { tavily } = await import('@tavily/core');
      const tavilyClient = tavily({ apiKey: this.tavilyApiKey });
      
      const response = await tavilyClient.search(query, {
        search_depth: "basic",
        include_answer: false,
        include_images: false,
        include_raw_content: false,
        max_results: numResults
      });

      if (!response || !response.results) {
        throw new Error('Invalid response from Tavily API');
      }

      const results: WebSearchResult[] = response.results.map((result: any, index: number) => ({
        title: result.title || `Result ${index + 1}`,
        link: result.url || '',
        snippet: result.content || result.snippet || '',
        source: `Web: ${new URL(result.url).hostname}`,
        score: result.score || 0.8
      }));

      console.log(`✅ Tavily search successful: ${results.length} results`);
      
      return {
        results,
        searchQuery: query,
        totalResults: results.length
      };

    } catch (error) {
      console.error('❌ Web search error:', error);
      return {
        results: [{
          title: `Error searching: ${query}`,
          link: '',
          snippet: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          source: 'Web: Error',
          score: 0.1
        }],
        searchQuery: query,
        totalResults: 0
      };
    }
  }
}

export const webSearchAgent = new SimpleWebSearchAgent();
