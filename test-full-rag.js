// Quick test for the RAG system after openai package fix
const fetch = require('node-fetch');

async function testRAGSystem() {
  console.log('🧪 Testing RAG System Integration...\n');
  
  const testTranscript = `
    User: Tell me about the latest developments in artificial intelligence.
    What are the current trends in machine learning?
  `;

  try {
    console.log('📝 Test transcript:', testTranscript);
    console.log('\n🚀 Sending request to /api/completion...');
    
    const response = await fetch('http://localhost:3000/api/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: testTranscript,
        flag: 'copilot',
        bg: 'Testing AI interview assistant with RAG capabilities'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('✅ Request successful!');
    console.log('📊 Response status:', response.status);
    
    // Read the streaming response
    const reader = response.body.getReader();
    let result = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += new TextDecoder().decode(value);
    }
    
    console.log('\n📋 Response preview:', result.substring(0, 200) + '...');
    console.log('\n✅ RAG system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

testRAGSystem();
