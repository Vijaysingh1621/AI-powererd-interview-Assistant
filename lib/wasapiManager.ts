/**
 * WASAPI Manager for Windows Audio Session API
 * Handles dual-channel audio capture: External (Interviewer) + System (Me)
 */

export interface AudioDeviceInfo {
  id: string;
  name: string;
  isDefault: boolean;
  type: 'input' | 'output';
}

export interface AudioStreamConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  bufferSize: number;
}

export interface AudioData {
  buffer: ArrayBuffer;
  timestamp: number;
  channel: 'external' | 'system';
  levels: {
    peak: number;
    rms: number;
  };
}

export class WASAPIManager {
  private isInitialized = false;
  private isCapturing = false;
  private externalAudioContext: AudioContext | null = null;
  private systemAudioContext: AudioContext | null = null;
  private externalStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private externalProcessor: AudioWorkletNode | null = null;
  private systemProcessor: AudioWorkletNode | null = null;
  
  // Audio level monitoring
  private externalAnalyzer: AnalyserNode | null = null;
  private systemAnalyzer: AnalyserNode | null = null;
  private audioLevelInterval: NodeJS.Timeout | null = null;
  
  // Callbacks
  private onAudioDataCallback?: (data: AudioData) => void;
  private onAudioLevelsCallback?: (external: number, system: number) => void;
  private onErrorCallback?: (error: Error) => void;

  constructor() {
    this.setupAudioWorklets();
  }

  /**
   * Initialize WASAPI Manager
   */
  async initialize(): Promise<void> {
    try {
      console.log('🎤 Initializing WASAPI Manager...');
      
      // Check for WASAPI support (Windows only)
      if (!this.isWindowsEnvironment()) {
        throw new Error('WASAPI is only supported on Windows');
      }

      // Initialize audio contexts
      this.externalAudioContext = new AudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      this.systemAudioContext = new AudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      await this.loadAudioWorklets();
      
      this.isInitialized = true;
      console.log('✅ WASAPI Manager initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize WASAPI Manager:', error);
      this.onErrorCallback?.(error as Error);
      throw error;
    }
  }

  /**
   * Start dual-channel audio capture
   */
  async startCapture(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('🎵 Starting dual-channel audio capture...');
      
      // Start external audio capture (microphone/interviewer)
      await this.startExternalAudioCapture();
      
      // Start system audio capture (system/me)
      await this.startSystemAudioCapture();
      
      // Start audio level monitoring
      this.startAudioLevelMonitoring();
      
      this.isCapturing = true;
      console.log('✅ Dual-channel audio capture started');
      
    } catch (error) {
      console.error('❌ Failed to start audio capture:', error);
      this.onErrorCallback?.(error as Error);
      throw error;
    }
  }

  /**
   * Stop audio capture
   */
  async stopCapture(): Promise<void> {
    console.log('🛑 Stopping audio capture...');
    
    try {
      // Stop audio level monitoring
      if (this.audioLevelInterval) {
        clearInterval(this.audioLevelInterval);
        this.audioLevelInterval = null;
      }

      // Stop external audio capture
      if (this.externalStream) {
        this.externalStream.getTracks().forEach(track => track.stop());
        this.externalStream = null;
      }

      // Stop system audio capture
      if (this.systemStream) {
        this.systemStream.getTracks().forEach(track => track.stop());
        this.systemStream = null;
      }

      // Disconnect audio processors
      if (this.externalProcessor) {
        this.externalProcessor.disconnect();
        this.externalProcessor = null;
      }

      if (this.systemProcessor) {
        this.systemProcessor.disconnect();
        this.systemProcessor = null;
      }

      this.isCapturing = false;
      console.log('✅ Audio capture stopped');
      
    } catch (error) {
      console.error('❌ Error stopping audio capture:', error);
      this.onErrorCallback?.(error as Error);
    }
  }

  /**
   * Start external audio capture (microphone/interviewer)
   */
  private async startExternalAudioCapture(): Promise<void> {
    try {
      console.log('🎤 Starting external audio capture...');
      
      // Get microphone access
      this.externalStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: 48000
        },
        video: false
      });

      if (!this.externalAudioContext) {
        throw new Error('External audio context not initialized');
      }

      // Create audio nodes
      const source = this.externalAudioContext.createMediaStreamSource(this.externalStream);
      
      // Create analyzer for level monitoring
      this.externalAnalyzer = this.externalAudioContext.createAnalyser();
      this.externalAnalyzer.fftSize = 256;
      this.externalAnalyzer.smoothingTimeConstant = 0.8;

      // Create audio processor worklet
      this.externalProcessor = new AudioWorkletNode(
        this.externalAudioContext,
        'audio-processor',
        {
          processorOptions: {
            channel: 'external'
          }
        }
      );

      // Setup audio processing chain
      source.connect(this.externalAnalyzer);
      this.externalAnalyzer.connect(this.externalProcessor);

      // Listen for processed audio data
      this.externalProcessor.port.onmessage = (event) => {
        const { audioData, timestamp, levels } = event.data;
        this.onAudioDataCallback?.({
          buffer: audioData,
          timestamp,
          channel: 'external',
          levels
        });
      };

      console.log('✅ External audio capture started');
      
    } catch (error) {
      console.error('❌ Failed to start external audio capture:', error);
      throw error;
    }
  }

  /**
   * Start system audio capture (system/me) using screen share with audio
   */
  private async startSystemAudioCapture(): Promise<void> {
    try {
      console.log('🔊 Starting system audio capture...');
      
      // Use getDisplayMedia for system audio capture
      this.systemStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: 1920,
          height: 1080,
          frameRate: 30
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2,
          sampleRate: 48000
        }
      });

      if (!this.systemAudioContext) {
        throw new Error('System audio context not initialized');
      }

      // Get only audio tracks
      const audioTracks = this.systemStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No system audio track available');
      }

      // Create audio-only stream
      const audioOnlyStream = new MediaStream(audioTracks);
      const source = this.systemAudioContext.createMediaStreamSource(audioOnlyStream);
      
      // Create analyzer for level monitoring
      this.systemAnalyzer = this.systemAudioContext.createAnalyser();
      this.systemAnalyzer.fftSize = 256;
      this.systemAnalyzer.smoothingTimeConstant = 0.8;

      // Create audio processor worklet
      this.systemProcessor = new AudioWorkletNode(
        this.systemAudioContext,
        'audio-processor',
        {
          processorOptions: {
            channel: 'system'
          }
        }
      );

      // Setup audio processing chain
      source.connect(this.systemAnalyzer);
      this.systemAnalyzer.connect(this.systemProcessor);

      // Listen for processed audio data
      this.systemProcessor.port.onmessage = (event) => {
        const { audioData, timestamp, levels } = event.data;
        this.onAudioDataCallback?.({
          buffer: audioData,
          timestamp,
          channel: 'system',
          levels
        });
      };

      console.log('✅ System audio capture started');
      
    } catch (error) {
      console.error('❌ Failed to start system audio capture:', error);
      throw error;
    }
  }

  /**
   * Start audio level monitoring
   */
  private startAudioLevelMonitoring(): void {
    this.audioLevelInterval = setInterval(() => {
      const externalLevel = this.getAudioLevel(this.externalAnalyzer);
      const systemLevel = this.getAudioLevel(this.systemAnalyzer);
      
      this.onAudioLevelsCallback?.(externalLevel, systemLevel);
    }, 100); // Update every 100ms
  }

  /**
   * Get current audio level from analyzer
   */
  private getAudioLevel(analyzer: AnalyserNode | null): number {
    if (!analyzer) return 0;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyzer.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    
    const average = sum / bufferLength;
    return average / 255; // Normalize to 0-1
  }

  /**
   * Setup audio worklets for processing
   */
  private async setupAudioWorklets(): Promise<void> {
    // Audio worklet will be loaded when needed
  }

  /**
   * Load audio worklets
   */
  private async loadAudioWorklets(): Promise<void> {
    try {
      const workletCode = `
        class AudioProcessor extends AudioWorkletProcessor {
          constructor(options) {
            super();
            this.channel = options.processorOptions?.channel || 'unknown';
          }

          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input && input.length > 0) {
              const inputData = input[0];
              
              // Calculate audio levels
              let peak = 0;
              let sum = 0;
              
              for (let i = 0; i < inputData.length; i++) {
                const sample = Math.abs(inputData[i]);
                peak = Math.max(peak, sample);
                sum += sample * sample;
              }
              
              const rms = Math.sqrt(sum / inputData.length);
              
              // Send processed audio data
              this.port.postMessage({
                audioData: inputData.buffer.slice(),
                timestamp: currentTime,
                levels: { peak, rms }
              });
            }
            
            return true;
          }
        }

        registerProcessor('audio-processor', AudioProcessor);
      `;

      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletURL = URL.createObjectURL(blob);

      if (this.externalAudioContext) {
        await this.externalAudioContext.audioWorklet.addModule(workletURL);
      }
      
      if (this.systemAudioContext) {
        await this.systemAudioContext.audioWorklet.addModule(workletURL);
      }

      URL.revokeObjectURL(workletURL);
      
    } catch (error) {
      console.error('❌ Failed to load audio worklets:', error);
      throw error;
    }
  }

  /**
   * Check if running on Windows
   */
  private isWindowsEnvironment(): boolean {
    return typeof window !== 'undefined' && 
           navigator.platform.toLowerCase().includes('win');
  }

  /**
   * Set callback for audio data
   */
  onAudioData(callback: (data: AudioData) => void): void {
    this.onAudioDataCallback = callback;
  }

  /**
   * Set callback for audio levels
   */
  onAudioLevels(callback: (external: number, system: number) => void): void {
    this.onAudioLevelsCallback = callback;
  }

  /**
   * Set callback for errors
   */
  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Get capture status
   */
  isCapturingAudio(): boolean {
    return this.isCapturing;
  }

  /**
   * Get available audio devices
   */
  async getAudioDevices(): Promise<AudioDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(device => device.kind === 'audioinput' || device.kind === 'audiooutput')
        .map(device => ({
          id: device.deviceId,
          name: device.label || `${device.kind} (${device.deviceId.substr(0, 8)})`,
          isDefault: device.deviceId === 'default',
          type: device.kind === 'audioinput' ? 'input' : 'output'
        }));
    } catch (error) {
      console.error('❌ Failed to get audio devices:', error);
      return [];
    }
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    console.log('🧹 Disposing WASAPI Manager...');
    
    await this.stopCapture();
    
    if (this.externalAudioContext) {
      await this.externalAudioContext.close();
      this.externalAudioContext = null;
    }
    
    if (this.systemAudioContext) {
      await this.systemAudioContext.close();
      this.systemAudioContext = null;
    }
    
    this.isInitialized = false;
    console.log('✅ WASAPI Manager disposed');
  }
}

// Export singleton instance
export const wasapiManager = new WASAPIManager();
