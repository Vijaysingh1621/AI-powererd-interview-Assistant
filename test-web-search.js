// Simple test to verify web search agent works
import { webSearchAgent } from './lib/agents/webSearchAgent.js';

async function testWebSearch() {
  try {
    console.log('🧪 Testing Web Search Agent...');
    
    const testQuery = "What is React";
    console.log('🔍 Test query:', testQuery);
    
    const result = await webSearchAgent.searchWeb(testQuery, 3);
    
    console.log('✅ Web Search Test Results:');
    console.log('- Search Query:', result.searchQuery);
    console.log('- Total Results:', result.totalResults);
    console.log('- Results Count:', result.results.length);
    
    if (result.results.length > 0) {
      console.log('📊 First result:');
      console.log('  Title:', result.results[0].title);
      console.log('  Snippet:', result.results[0].snippet.substring(0, 100) + '...');
      console.log('  Source:', result.results[0].source);
      console.log('  Score:', result.results[0].score);
    }
    
  } catch (error) {
    console.error('❌ Web Search Test Failed:', error);
  }
}

testWebSearch();
