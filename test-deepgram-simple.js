const { createClient } = require("@deepgram/sdk");
require('dotenv').config({ path: '.env.local' });

async function testDeepgramConnection() {
    console.log('🧪 Testing Deepgram connection...');
    
    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
        console.error('❌ DEEPGRAM_API_KEY not found in environment');
        return;
    }
    
    console.log('✅ API key found:', apiKey.substring(0, 8) + '...');
    
    try {
        const client = createClient(apiKey);
        
        // Test connection with minimal configuration
        const connection = client.listen.live({
            model: "nova-2",
            language: "en-US",
            punctuate: true,
            interim_results: true,
            smart_format: true,
            encoding: "linear16",
            sample_rate: 48000,
            channels: 1
        });
        
        console.log('🔌 Creating connection...');
        
        connection.addListener('open', () => {
            console.log('✅ Connection opened');
            
            // Send a simple test audio buffer (silence)
            const sampleRate = 48000;
            const duration = 1; // 1 second
            const numSamples = sampleRate * duration;
            const testBuffer = new Int16Array(numSamples);
            
            // Fill with low-level noise instead of silence
            for (let i = 0; i < numSamples; i++) {
                testBuffer[i] = Math.floor(Math.random() * 1000 - 500);
            }
            
            console.log('📤 Sending test audio buffer:', testBuffer.buffer.byteLength, 'bytes');
            connection.send(testBuffer.buffer);
            
            // Close after 3 seconds
            setTimeout(() => {
                console.log('🔌 Closing connection...');
                connection.requestClose();
            }, 3000);
        });
        
        connection.addListener('results', (data) => {
            console.log('📥 Received results:', JSON.stringify(data, null, 2));
        });
        
        connection.addListener('transcript', (data) => {
            console.log('📝 Received transcript:', JSON.stringify(data, null, 2));
        });
        
        connection.addListener('error', (error) => {
            console.error('❌ Connection error:', error);
        });
        
        connection.addListener('close', () => {
            console.log('🔌 Connection closed');
            process.exit(0);
        });
        
        connection.addListener('metadata', (data) => {
            console.log('📊 Metadata:', data);
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testDeepgramConnection().catch(console.error);
