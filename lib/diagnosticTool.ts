/**
 * Comprehensive WASAPI + Deepgram Diagnostic Tool
 * Tests the complete audio capture to transcript pipeline
 */

export class AudioTranscriptDiagnostic {
  private logs: string[] = [];
  private testResults: any = {};

  log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    this.logs.push(logMessage);
    console.log(logMessage);
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }

  async runFullDiagnostic() {
    this.clearLogs();
    this.log('🔍 Starting Full WASAPI + Deepgram Diagnostic');
    
    const results = {
      environment: await this.testEnvironment(),
      deepgramDirect: await this.testDeepgramDirect(),
      audioCapture: await this.testAudioCapture(),
      transcriptionFlow: await this.testTranscriptionFlow(),
      uiUpdates: await this.testUIUpdates()
    };
    
    this.testResults = results;
    this.log('📊 Full diagnostic complete');
    return results;
  }

  async testEnvironment() {
    this.log('🌐 Testing Environment...');
    
    const env = {
      browser: typeof window !== 'undefined',
      mediaDevices: !!(navigator?.mediaDevices?.getUserMedia),
      webSocket: typeof WebSocket !== 'undefined',
      deepgramKey: !!process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY,
      audioContext: typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined'
    };
    
    Object.entries(env).forEach(([key, value]) => {
      this.log(`  ${value ? '✅' : '❌'} ${key}: ${value}`);
    });
    
    return env;
  }

  async testDeepgramDirect() {
    this.log('🎤 Testing Direct Deepgram Connection...');
    
    try {
      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      if (!apiKey) {
        throw new Error('No API key found');
      }
      
      const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=en&punctuate=true&interim_results=true&sample_rate=48000&channels=1&encoding=linear16`;
      
      return new Promise((resolve) => {
        const ws = new WebSocket(wsUrl, ['token', apiKey]);
        let connected = false;
        let receivedData = false;
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve({
            connected,
            receivedData,
            status: connected ? (receivedData ? 'success' : 'connected_no_data') : 'failed'
          });
        }, 5000);
        
        ws.onopen = () => {
          connected = true;
          this.log('  ✅ Deepgram WebSocket connected');
          
          // Send test audio (silence with small beep)
          const sampleRate = 48000;
          const duration = 1;
          const samples = sampleRate * duration;
          const buffer = new Int16Array(samples);
          
          // Generate a simple test tone
          for (let i = 0; i < samples; i++) {
            buffer[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 1000;
          }
          
          ws.send(buffer.buffer);
          this.log('  📤 Sent test audio data');
        };
        
        ws.onmessage = (event) => {
          receivedData = true;
          try {
            const data = JSON.parse(event.data);
            this.log(`  📨 Received: ${data.type}`);
            if (data.type === 'Results') {
              this.log(`  📝 Transcript data: ${JSON.stringify(data)}`);
            }
          } catch (e) {
            this.log(`  📨 Non-JSON data: ${event.data}`);
          }
        };
        
        ws.onerror = (error) => {
          this.log(`  ❌ WebSocket error: ${error}`);
          clearTimeout(timeout);
          resolve({ connected: false, receivedData: false, status: 'error', error });
        };
        
        ws.onclose = (event) => {
          this.log(`  🔌 WebSocket closed: ${event.code} ${event.reason}`);
          clearTimeout(timeout);
          resolve({
            connected,
            receivedData,
            status: connected ? 'success' : 'failed',
            closeCode: event.code,
            closeReason: event.reason
          });
        };
      });
      
    } catch (error) {
      this.log(`  ❌ Direct test failed: ${error}`);
      return { status: 'error', error: String(error) };
    }
  }

  async testAudioCapture() {
    this.log('🎵 Testing Audio Capture...');
    
    try {
      // Test getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      this.log('  ✅ Microphone access granted');
      
      // Test AudioContext
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 48000
      });
      
      this.log('  ✅ AudioContext created');
      
      // Test audio processing
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      this.log('  ✅ Audio processing setup complete');
      
      // Test for 2 seconds to see if we get audio data
      let hasAudioLevel = false;
      const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        if (average > 0) {
          hasAudioLevel = true;
          this.log(`  📊 Audio level detected: ${average.toFixed(2)}`);
        }
      };
      
      const interval = setInterval(checkAudio, 100);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      clearInterval(interval);
      stream.getTracks().forEach(track => track.stop());
      audioContext.close();
      
      return {
        microphoneAccess: true,
        audioContext: true,
        hasAudioLevel,
        status: hasAudioLevel ? 'success' : 'no_audio_detected'
      };
      
    } catch (error) {
      this.log(`  ❌ Audio capture failed: ${error}`);
      return { status: 'error', error: String(error) };
    }
  }

  async testTranscriptionFlow() {
    this.log('🔄 Testing Transcription Flow...');
    
    try {
      // Import the necessary modules
      const { wasapiDeepgramHandler } = await import('@/lib/wasapiHandler');
      
      let transcriptionReceived = false;
      let errorReceived = false;
      
      // Set up event handlers
      wasapiDeepgramHandler.onTranscription((message) => {
        transcriptionReceived = true;
        this.log(`  📝 Transcription received: ${JSON.stringify(message)}`);
      });
      
      wasapiDeepgramHandler.onError((error, source) => {
        errorReceived = true;
        this.log(`  ❌ Transcription error from ${source}: ${error.message}`);
      });
      
      // Test initialization
      await wasapiDeepgramHandler.initialize();
      this.log('  ✅ Handler initialized');
      
      // Test start
      await wasapiDeepgramHandler.start();
      this.log('  ✅ Handler started');
      
      // Wait for 3 seconds to see if we get any data
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Test stop
      await wasapiDeepgramHandler.stop();
      this.log('  ✅ Handler stopped');
      
      return {
        initialized: true,
        started: true,
        transcriptionReceived,
        errorReceived,
        status: transcriptionReceived ? 'success' : (errorReceived ? 'error' : 'no_data')
      };
      
    } catch (error) {
      this.log(`  ❌ Transcription flow failed: ${error}`);
      return { status: 'error', error: String(error) };
    }
  }

  async testUIUpdates() {
    this.log('🖥️ Testing UI Updates...');
    
    try {
      // Test transcription manager
      const { transcriptionManager } = await import('@/lib/transcriptionManager');
      
      const testText = "This is a test transcription";
      const shouldAdd = transcriptionManager.shouldAddTranscript(testText, true, 'user');
      this.log(`  📝 TranscriptionManager.shouldAddTranscript: ${shouldAdd}`);
      
      if (shouldAdd) {
        const messages = transcriptionManager.getMessages();
        this.log(`  📋 Messages count: ${messages.length}`);
        
        const formatted = transcriptionManager.formatWithTimestamp(testText);
        this.log(`  📅 Formatted text: ${formatted}`);
      }
      
      return {
        transcriptionManager: true,
        shouldAddTranscript: shouldAdd,
        status: 'success'
      };
      
    } catch (error) {
      this.log(`  ❌ UI update test failed: ${error}`);
      return { status: 'error', error: String(error) };
    }
  }
}

// Export for browser use
if (typeof window !== 'undefined') {
  (window as any).AudioTranscriptDiagnostic = AudioTranscriptDiagnostic;
}
