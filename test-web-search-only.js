// Quick test for web search agent
const fetch = require('node-fetch');

async function testWebSearch() {
  console.log('🧪 Testing Web Search Agent...\n');
  
  try {
    console.log('🚀 Sending request to /api/test-web-search...');
    
    const response = await fetch('http://localhost:3000/api/test-web-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'machine learning trends 2024'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Web search test successful!');
    console.log('📊 Response:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Web search test failed:', error.message);
    console.error(error);
  }
}

testWebSearch();
