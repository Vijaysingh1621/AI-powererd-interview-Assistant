/**
 * WASAPI + Deepgram Dual-Channel Audio Debug Script
 * Test and debug the integrated audio capture and transcription system
 */

console.log('🎤 WASAPI + Deepgram Debug Script Loaded');

class AudioDebugger {
  constructor() {
    this.isRunning = false;
    this.startTime = null;
    this.stats = {
      externalMessages: 0,
      systemMessages: 0,
      totalDuration: 0,
      errors: []
    };
    
    this.setupUI();
  }

  setupUI() {
    // Create debug UI
    const debugContainer = document.createElement('div');
    debugContainer.id = 'audio-debug-panel';
    debugContainer.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 300px;
      background: white;
      border: 2px solid #ccc;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: monospace;
      font-size: 12px;
      max-height: 80vh;
      overflow-y: auto;
    `;

    debugContainer.innerHTML = `
      <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0; color: #333;">🎤 WASAPI Debug</h3>
        <button id="close-debug" style="background: #ff6b6b; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">×</button>
      </div>
      
      <div style="margin-bottom: 10px;">
        <button id="start-test" style="background: #4CAF50; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Start Test</button>
        <button id="stop-test" style="background: #f44336; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;" disabled>Stop Test</button>
      </div>

      <div style="margin-bottom: 10px;">
        <strong>Status:</strong> <span id="debug-status">Idle</span>
      </div>

      <div style="margin-bottom: 10px;">
        <strong>Audio Levels:</strong><br>
        <div style="margin: 5px 0;">
          Interviewer: <span id="external-level">0%</span>
          <div style="width: 100%; height: 4px; background: #eee; border-radius: 2px;">
            <div id="external-bar" style="width: 0%; height: 100%; background: #2196F3; border-radius: 2px; transition: width 0.1s;"></div>
          </div>
        </div>
        <div style="margin: 5px 0;">
          Me: <span id="system-level">0%</span>
          <div style="width: 100%; height: 4px; background: #eee; border-radius: 2px;">
            <div id="system-bar" style="width: 0%; height: 100%; background: #4CAF50; border-radius: 2px; transition: width 0.1s;"></div>
          </div>
        </div>
      </div>

      <div style="margin-bottom: 10px;">
        <strong>Connection:</strong><br>
        External: <span id="external-status">❌ Disconnected</span><br>
        System: <span id="system-status">❌ Disconnected</span>
      </div>

      <div style="margin-bottom: 10px;">
        <strong>Statistics:</strong><br>
        Interviewer Messages: <span id="external-count">0</span><br>
        Me Messages: <span id="system-count">0</span><br>
        Uptime: <span id="uptime">00:00</span><br>
        Errors: <span id="error-count">0</span>
      </div>

      <div style="margin-bottom: 10px;">
        <strong>Latest Transcription:</strong>
        <div id="latest-transcript" style="background: #f5f5f5; padding: 5px; border-radius: 3px; margin-top: 5px; max-height: 100px; overflow-y: auto; font-size: 11px;">
          No transcription yet...
        </div>
      </div>

      <div>
        <strong>Errors:</strong>
        <div id="error-log" style="background: #fff3cd; padding: 5px; border-radius: 3px; margin-top: 5px; max-height: 80px; overflow-y: auto; font-size: 10px;">
          No errors yet...
        </div>
      </div>
    `;

    document.body.appendChild(debugContainer);

    // Setup event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Close button
    document.getElementById('close-debug').addEventListener('click', () => {
      document.getElementById('audio-debug-panel').remove();
    });

    // Start test button
    document.getElementById('start-test').addEventListener('click', () => {
      this.startTest();
    });

    // Stop test button
    document.getElementById('stop-test').addEventListener('click', () => {
      this.stopTest();
    });
  }

  async startTest() {
    try {
      this.updateStatus('Initializing...');
      this.logMessage('🚀 Starting WASAPI + Deepgram test...');

      // Check if WASAPI handler is available
      if (typeof window.wasapiDeepgramHandler === 'undefined') {
        throw new Error('WASAPI Deepgram Handler not found. Make sure the page is fully loaded.');
      }

      const handler = window.wasapiDeepgramHandler;

      // Setup event listeners
      handler.onTranscription((message) => {
        this.handleTranscription(message);
      });

      handler.onStatusUpdate((status) => {
        this.handleStatusUpdate(status);
      });

      handler.onAudioLevels((levels) => {
        this.handleAudioLevels(levels);
      });

      handler.onError((error, source) => {
        this.handleError(error, source);
      });

      // Start the system
      await handler.start();

      this.isRunning = true;
      this.startTime = Date.now();
      this.updateStatus('Running');
      
      document.getElementById('start-test').disabled = true;
      document.getElementById('stop-test').disabled = false;

      // Start uptime counter
      this.startUptimeCounter();

      this.logMessage('✅ Test started successfully');

    } catch (error) {
      this.handleError(error, 'test-start');
      this.updateStatus('Error');
    }
  }

  async stopTest() {
    try {
      this.updateStatus('Stopping...');
      this.logMessage('🛑 Stopping test...');

      if (typeof window.wasapiDeepgramHandler !== 'undefined') {
        await window.wasapiDeepgramHandler.stop();
      }

      this.isRunning = false;
      this.startTime = null;
      this.updateStatus('Stopped');

      document.getElementById('start-test').disabled = false;
      document.getElementById('stop-test').disabled = true;

      this.logMessage('✅ Test stopped');

    } catch (error) {
      this.handleError(error, 'test-stop');
    }
  }

  handleTranscription(message) {
    console.log('📝 Debug transcription:', message);

    // Update counters
    if (message.speaker === 'external') {
      this.stats.externalMessages++;
      document.getElementById('external-count').textContent = this.stats.externalMessages;
    } else {
      this.stats.systemMessages++;
      document.getElementById('system-count').textContent = this.stats.systemMessages;
    }

    // Update latest transcript
    const transcriptDiv = document.getElementById('latest-transcript');
    const speaker = message.speaker === 'external' ? '👤 Interviewer' : '🖥️ Me';
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    
    transcriptDiv.innerHTML = `
      <div style="border-bottom: 1px solid #ddd; padding: 2px 0; margin: 2px 0;">
        <strong>${speaker}</strong> <span style="color: #666;">${timestamp}</span><br>
        <span style="color: ${message.isInterim ? '#888' : '#000'};">
          ${message.text} ${message.isInterim ? '(interim)' : ''}
        </span>
      </div>
    ` + transcriptDiv.innerHTML;

    // Keep only last 5 messages
    const messages = transcriptDiv.children;
    while (messages.length > 5) {
      transcriptDiv.removeChild(messages[messages.length - 1]);
    }
  }

  handleStatusUpdate(status) {
    console.log('📊 Debug status:', status);

    // Update connection status
    document.getElementById('external-status').textContent = 
      status.external.connected ? '✅ Connected' : '❌ Disconnected';
    document.getElementById('system-status').textContent = 
      status.system.connected ? '✅ Connected' : '❌ Disconnected';
  }

  handleAudioLevels(levels) {
    // Update audio level displays
    const externalPercent = Math.round(levels.external * 100);
    const systemPercent = Math.round(levels.system * 100);

    document.getElementById('external-level').textContent = externalPercent + '%';
    document.getElementById('system-level').textContent = systemPercent + '%';

    document.getElementById('external-bar').style.width = externalPercent + '%';
    document.getElementById('system-bar').style.width = systemPercent + '%';
  }

  handleError(error, source) {
    console.error('❌ Debug error:', error, 'Source:', source);

    this.stats.errors.push({
      error: error.message || error.toString(),
      source,
      timestamp: new Date().toISOString()
    });

    // Update error display
    const errorLog = document.getElementById('error-log');
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'border-bottom: 1px solid #f5c6cb; padding: 2px 0; margin: 2px 0;';
    errorDiv.innerHTML = `
      <strong style="color: #721c24;">${source}:</strong> 
      <span style="color: #856404;">${error.message || error.toString()}</span><br>
      <span style="color: #666; font-size: 9px;">${new Date().toLocaleTimeString()}</span>
    `;
    
    errorLog.insertBefore(errorDiv, errorLog.firstChild);

    // Update error count
    document.getElementById('error-count').textContent = this.stats.errors.length;

    // Keep only last 10 errors
    while (errorLog.children.length > 10) {
      errorLog.removeChild(errorLog.lastChild);
    }
  }

  updateStatus(status) {
    document.getElementById('debug-status').textContent = status;
    console.log('🔄 Debug status updated:', status);
  }

  startUptimeCounter() {
    setInterval(() => {
      if (this.isRunning && this.startTime) {
        const uptime = Date.now() - this.startTime;
        const minutes = Math.floor(uptime / 60000);
        const seconds = Math.floor((uptime % 60000) / 1000);
        document.getElementById('uptime').textContent = 
          `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  logMessage(message) {
    console.log(message);
  }

  // Expose methods for manual testing
  getStats() {
    return this.stats;
  }

  getHandler() {
    return window.wasapiDeepgramHandler;
  }

  async testAudioDevices() {
    try {
      if (typeof window.wasapiManager !== 'undefined') {
        const devices = await window.wasapiManager.getAudioDevices();
        console.log('🎤 Available audio devices:', devices);
        return devices;
      } else {
        console.warn('⚠️ WASAPI Manager not available');
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to get audio devices:', error);
      return [];
    }
  }

  async testDeepgramConnection() {
    try {
      const response = await fetch('/api/deepgram');
      const data = await response.json();
      console.log('🔑 Deepgram API test:', data);
      return data;
    } catch (error) {
      console.error('❌ Deepgram API test failed:', error);
      return null;
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.audioDebugger = new AudioDebugger();
    console.log('🎤 Audio debugger initialized');
  });
} else {
  window.audioDebugger = new AudioDebugger();
  console.log('🎤 Audio debugger initialized');
}

// Expose debug functions globally
window.debugWASAPI = {
  start: () => window.audioDebugger?.startTest(),
  stop: () => window.audioDebugger?.stopTest(),
  stats: () => window.audioDebugger?.getStats(),
  devices: () => window.audioDebugger?.testAudioDevices(),
  deepgram: () => window.audioDebugger?.testDeepgramConnection(),
  handler: () => window.audioDebugger?.getHandler()
};

console.log('🔧 Debug functions available: window.debugWASAPI');
console.log('   - window.debugWASAPI.start() - Start test');
console.log('   - window.debugWASAPI.stop() - Stop test');
console.log('   - window.debugWASAPI.stats() - Get statistics');
console.log('   - window.debugWASAPI.devices() - Test audio devices');
console.log('   - window.debugWASAPI.deepgram() - Test Deepgram API');