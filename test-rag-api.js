const fetch = require('node-fetch');

async function testRAGAPI() {
    try {
        console.log('🧪 Testing RAG API endpoint...');
        
        const response = await fetch('http://localhost:3000/api/rag', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                transcript: 'I was asked about React hooks in my interview. Can you help explain them?'
            })
        });
        
        console.log('📊 Response Status:', response.status);
        console.log('📊 Response Headers:', Object.fromEntries(response.headers));
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ RAG API Success!');
            console.log('📄 Response Data:', JSON.stringify(data, null, 2));
        } else {
            const errorText = await response.text();
            console.log('❌ RAG API Error:');
            console.log('📄 Error Response:', errorText);
        }
    } catch (error) {
        console.error('💥 Test Failed:', error.message);
    }
}

testRAGAPI();
