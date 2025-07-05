/**
 * Deepgram Connection Test
 * Tests basic connectivity and transcription capability
 */

export async function testDeepgramConnection() {
  console.log('🧪 Testing Deepgram connection...');
  
  try {
    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('No Deepgram API key found');
    }
    
    // Test WebSocket connection
    const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=en&punctuate=true&interim_results=true&endpointing=300&smart_format=true&sample_rate=48000&channels=1&encoding=linear16`;
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, ['token', apiKey]);
      let hasReceivedTranscript = false;
      
      const timeout = setTimeout(() => {
        ws.close();
        if (!hasReceivedTranscript) {
          reject(new Error('No transcript received in test period'));
        }
      }, 10000);
      
      ws.onopen = () => {
        console.log('✅ Test WebSocket connected');
        
        // Send a simple test audio buffer (silence + tone)
        // This creates a simple sine wave at 440Hz for testing
        const sampleRate = 48000;
        const duration = 1; // 1 second
        const frequency = 440; // A4 note
        const samples = sampleRate * duration;
        const buffer = new Int16Array(samples);
        
        for (let i = 0; i < samples; i++) {
          buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 16383;
        }
        
        console.log('🎵 Sending test audio data...', buffer.byteLength, 'bytes');
        ws.send(buffer.buffer);
        
        // Send close signal after sending data
        setTimeout(() => {
          ws.send(JSON.stringify({ type: 'CloseStream' }));
        }, 2000);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Test response from Deepgram:', data);
          
          if (data.type === 'Results') {
            hasReceivedTranscript = true;
            clearTimeout(timeout);
            ws.close();
            resolve({
              success: true,
              hasTranscript: !!(data.channel?.alternatives?.[0]?.transcript || 
                               data.alternatives?.[0]?.transcript ||
                               data.transcript),
              data: data
            });
          }
        } catch (e) {
          console.log('📨 Non-JSON response:', event.data);
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ Test WebSocket error:', error);
        clearTimeout(timeout);
        reject(error);
      };
      
      ws.onclose = () => {
        console.log('🔌 Test WebSocket closed');
        clearTimeout(timeout);
        if (!hasReceivedTranscript) {
          resolve({
            success: true,
            hasTranscript: false,
            message: 'Connection successful but no transcript (normal for test tone)'
          });
        }
      };
    });
    
  } catch (error) {
    console.error('❌ Deepgram test failed:', error);
    throw error;
  }
}

// Export for browser testing
if (typeof window !== 'undefined') {
  (window as any).testDeepgramConnection = testDeepgramConnection;
}
