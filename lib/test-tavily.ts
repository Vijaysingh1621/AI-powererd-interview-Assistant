// Simple test for Tavily integration
import { tavily } from '@tavily/core';

async function testTavilyDirect() {
  try {
    console.log('🧪 Testing Tavily Direct Integration...');
    
    const apiKey = process.env.TAVILY_API_KEY || 'tvly-placeholder-add-your-tavily-key-here';
    console.log('🔑 API Key length:', apiKey.length);
    console.log('🔑 API Key configured:', apiKey !== 'tvly-placeholder-add-your-tavily-key-here');
    
    if (apiKey === 'tvly-placeholder-add-your-tavily-key-here') {
      console.log('❌ Tavily API key not configured, using mock results');
      return {
        success: true,
        results: [{
          title: 'Mock Result',
          url: 'https://example.com',
          content: 'This is a mock result since Tavily API key is not configured',
          score: 0.5
        }],
        message: 'Mock results returned due to missing API key'
      };
    }
    
    const client = tavily({ apiKey });
    console.log('✅ Tavily client created successfully');
    
    const response = await client.search('What is React', {
      maxResults: 3,
      searchDepth: 'basic'
    });
    
    console.log('✅ Tavily search completed');
    console.log('📊 Results count:', response.results?.length || 0);
    
    return {
      success: true,
      results: response.results || [],
      message: 'Tavily search completed successfully'
    };
    
  } catch (error) {
    console.error('❌ Tavily test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Tavily test failed'
    };
  }
}

export { testTavilyDirect };
