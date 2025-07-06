/**
 * Test script to verify the transcription flow
 */

// This script tests the transcription pipeline to identify where the issue is

async function testTranscriptionFlow() {
  console.log('🔍 Testing transcription flow...');
  
  try {
    // Test 1: Check if environment variables are available
    console.log('\n📋 Test 1: Environment Variables');
    const deepgramKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    console.log('Deepgram API Key present:', !!deepgramKey);
    console.log('Deepgram API Key length:', deepgramKey?.length || 0);
    
    // Test 2: Try to import and initialize the transcription manager
    console.log('\n📋 Test 2: Transcription Manager');
    const { transcriptionManager } = await import('./lib/transcriptionManager.js');
    console.log('Transcription manager imported:', !!transcriptionManager);
    
    // Test adding a message directly
    transcriptionManager.addMessage('Test message from script', 'external', true);
    const messages = transcriptionManager.getMessages();
    console.log('Messages after adding test:', messages.length);
    console.log('Latest message:', messages[messages.length - 1]);
    
    // Test 3: Check if wasapi handler can be imported
    console.log('\n📋 Test 3: WASAPI Handler');
    try {
      const { wasapiDeepgramHandler } = await import('./lib/wasapiHandler.js');
      console.log('WASAPI Handler imported:', !!wasapiDeepgramHandler);
      
      // Test setting up a callback
      wasapiDeepgramHandler.onTranscription((message) => {
        console.log('🎉 Received transcription in test:', message);
      });
      console.log('Callback set successfully');
      
    } catch (error) {
      console.error('❌ Error importing WASAPI Handler:', error.message);
    }
    
    // Test 4: Check Deepgram client
    console.log('\n📋 Test 4: Deepgram Client');
    try {
      const { dualChannelDeepgram } = await import('./lib/deepgramClient.js');
      console.log('Deepgram client imported:', !!dualChannelDeepgram);
      
      // Test setting up callback
      dualChannelDeepgram.onTranscription((result) => {
        console.log('🎉 Received Deepgram result in test:', result);
      });
      console.log('Deepgram callback set successfully');
      
    } catch (error) {
      console.error('❌ Error importing Deepgram Client:', error.message);
    }
    
    console.log('\n✅ Transcription flow test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTranscriptionFlow().catch(console.error);
