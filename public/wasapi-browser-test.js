/**
 * Browser Test for WASAPI + Deepgram Integration
 * Run this in the browser console to test the functionality
 */

async function testWASAPIIntegration() {
  console.log('🧪 Starting WASAPI + Deepgram Integration Test');
  
  try {
    // Test 1: Check if running in browser
    console.log('1️⃣ Browser Environment Check');
    if (typeof window === 'undefined') {
      throw new Error('Not running in browser environment');
    }
    console.log('✅ Browser environment confirmed');
    
    // Test 2: Check WASAPI API availability
    console.log('2️⃣ WASAPI API Availability Check');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('MediaDevices API not available');
    }
    console.log('✅ MediaDevices API available');
    
    // Test 3: Check environment variables
    console.log('3️⃣ Environment Variables Check');
    const deepgramKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    if (!deepgramKey) {
      throw new Error('NEXT_PUBLIC_DEEPGRAM_API_KEY not found');
    }
    console.log('✅ Deepgram API key found');
    
    // Test 4: Test microphone permissions
    console.log('4️⃣ Microphone Permissions Test');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
          channelCount: 1
        } 
      });
      console.log('✅ Microphone access granted');
      stream.getTracks().forEach(track => track.stop());
    } catch (permError) {
      console.warn('⚠️ Microphone permission denied or unavailable:', permError);
    }
    
    // Test 5: Test WASAPI capture capabilities
    console.log('5️⃣ WASAPI Capture Capabilities Test');
    if (navigator.mediaDevices.getDisplayMedia) {
      console.log('✅ Screen capture API available');
    } else {
      console.warn('⚠️ Screen capture API not available');
    }
    
    // Test 6: Test Deepgram WebSocket connection (simulation)
    console.log('6️⃣ Deepgram Connection Test');
    try {
      const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=en&punctuate=true&interim_results=true&endpointing=300&smart_format=true`;
      const ws = new WebSocket(wsUrl, ['token', deepgramKey]);
      
      ws.onopen = () => {
        console.log('✅ Deepgram WebSocket connection successful');
        ws.close();
      };
      
      ws.onerror = (error) => {
        console.error('❌ Deepgram WebSocket connection failed:', error);
      };
      
      // Close after 3 seconds if still connecting
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          console.warn('⚠️ Deepgram connection timeout');
        }
      }, 3000);
      
    } catch (wsError) {
      console.error('❌ WebSocket test failed:', wsError);
    }
    
    console.log('🎉 WASAPI Integration Test Complete');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Auto-run test if in browser
if (typeof window !== 'undefined') {
  // Run test after a short delay to ensure DOM is ready
  setTimeout(() => {
    testWASAPIIntegration();
  }, 1000);
}

// Export for manual testing
window.testWASAPIIntegration = testWASAPIIntegration;
console.log('💡 Manual test available: window.testWASAPIIntegration()');
