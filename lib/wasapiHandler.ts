/**
 * Integrated WASAPI + Deepgram Handler
 * Combines WASAPI audio capture with Deepgram transcription
 */

import { wasapiManager, AudioData } from './wasapiManager';
import { dualChannelDeepgram, TranscriptionResult } from './deepgramClient';
import { AudioConverter, AudioBufferManager } from './audioConverter';
import { transcriptionManager, ChatMessage } from './transcriptionManager';

export interface DualChannelStatus {
  external: {
    capturing: boolean;
    transcribing: boolean;
    connected: boolean;
    audioLevel: number;
    lastActivity: number;
  };
  system: {
    capturing: boolean;
    transcribing: boolean;
    connected: boolean;
    audioLevel: number;
    lastActivity: number;
  };
  overall: {
    active: boolean;
    startTime: number | null;
    totalDuration: number;
  };
}

export interface AudioLevels {
  external: number;
  system: number;
}

export class WASAPIDeepgramHandler {
  private callbacks: {
    onTranscription?: (message: ChatMessage) => void;
    onStatusUpdate?: (status: DualChannelStatus) => void;
    onError?: (error: Error, channel?: string) => void;
  } = {};
  
  private isActive = false;
  private isInitialized = false;
  private startTime: number | null = null;
  
  // Callback properties for backward compatibility
  private onTranscriptionCallback?: (message: ChatMessage) => void;
  private onStatusUpdateCallback?: (status: DualChannelStatus) => void;
  private onAudioLevelsCallback?: (levels: AudioLevels) => void;
  private onErrorCallback?: (error: Error, source: string) => void;
  
  // Audio buffers for smooth streaming
  private externalBuffer = new AudioBufferManager(500); // 500ms buffer
  private systemBuffer = new AudioBufferManager(500);
  
  // Audio level tracking
  private currentAudioLevels: AudioLevels = { external: 0, system: 0 };
  private lastActivityTime = { external: 0, system: 0 };
  
  // Processing intervals
  private streamingInterval: NodeJS.Timeout | null = null;
  private statusUpdateInterval: NodeJS.Timeout | null = null;
  
  // Deepgram client - initialized lazily in browser
  private dualChannelDeepgram: any = null;

  /**
   * Initialize the integrated handler
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing WASAPI + Deepgram Handler...');
      
      // Initialize WASAPI Manager
      await wasapiManager.initialize();
      
      // Get Deepgram client and setup event handlers
      this.getDeepgramClient();
      
      // Initialize Deepgram Client
      await this.dualChannelDeepgram.connect();
      
      this.isInitialized = true;
      console.log('✅ WASAPI + Deepgram Handler initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize handler:', error);
      this.onErrorCallback?.(error as Error, 'initialization');
      throw error;
    }
  }

  /**
   * Start dual-channel audio capture and transcription
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('▶️ Starting dual-channel capture and transcription...');
      
      // Start audio capture
      await wasapiManager.startCapture();
      
      // Start transcription
      await this.getDeepgramClient().startTranscription();
      
      // Start audio streaming
      this.startAudioStreaming();
      
      // Start status updates
      this.startStatusUpdates();
      
      this.isActive = true;
      this.startTime = Date.now();
      
      console.log('✅ Dual-channel system active');
      
    } catch (error) {
      console.error('❌ Failed to start dual-channel system:', error);
      this.onErrorCallback?.(error as Error, 'start');
      throw error;
    }
  }

  /**
   * Stop all capture and transcription
   */
  async stop(): Promise<void> {
    console.log('⏹️ Stopping dual-channel system...');
    
    try {
      // Stop intervals
      if (this.streamingInterval) {
        clearInterval(this.streamingInterval);
        this.streamingInterval = null;
      }
      
      if (this.statusUpdateInterval) {
        clearInterval(this.statusUpdateInterval);
        this.statusUpdateInterval = null;
      }
      
      // Stop audio capture
      await wasapiManager.stopCapture();
      
      // Stop transcription
      await this.getDeepgramClient().stopTranscription();
      
      // Clear buffers
      this.externalBuffer.clear();
      this.systemBuffer.clear();
      
      this.isActive = false;
      this.startTime = null;
      
      console.log('✅ Dual-channel system stopped');
      
    } catch (error) {
      console.error('❌ Error stopping dual-channel system:', error);
      this.onErrorCallback?.(error as Error, 'stop');
    }
  }

  /**
   * Setup event handlers for WASAPI and Deepgram
   */
  private setupEventHandlers(): void {
    // WASAPI audio data handler
    wasapiManager.onAudioData((audioData: AudioData) => {
      this.handleAudioData(audioData);
    });

    // WASAPI audio levels handler
    wasapiManager.onAudioLevels((external: number, system: number) => {
      this.currentAudioLevels = { external, system };
      this.onAudioLevelsCallback?.({ external, system });
      
      // Update last activity time if audio detected
      const now = Date.now();
      if (external > 0.01) this.lastActivityTime.external = now;
      if (system > 0.01) this.lastActivityTime.system = now;
    });

    // WASAPI error handler
    wasapiManager.onError((error: Error) => {
      console.error('❌ WASAPI Error:', error);
      this.onErrorCallback?.(error, 'wasapi');
    });

    // Deepgram transcription handler
    this.getDeepgramClient().onTranscription((result: TranscriptionResult) => {
      this.handleTranscriptionResult(result);
    });

    // Deepgram error handler
    this.getDeepgramClient().onError((error: Error, channel: 'external' | 'system') => {
      console.error(`❌ Deepgram Error (${channel}):`, error);
      this.onErrorCallback?.(error, `deepgram-${channel}`);
    });

    // Deepgram connection status handler
    this.getDeepgramClient().onConnectionStatus((status: 'connected' | 'disconnected' | 'error', channel: 'external' | 'system') => {
      console.log(`🔌 Deepgram ${channel} status: ${status}`);
      
      if (status === 'error' || status === 'disconnected') {
        // Attempt reconnection after a delay
        setTimeout(() => {
          if (this.isActive) {
            console.log(`🔄 Attempting to reconnect ${channel} channel...`);
            this.getDeepgramClient().reconnectChannel(channel).catch(console.error);
          }
        }, 3000);
      }
    });
  }

  /**
   * Handle incoming audio data
   */
  private handleAudioData(audioData: AudioData): void {
    try {
      // Convert ArrayBuffer to Float32Array
      const float32Data = new Float32Array(audioData.buffer);
      
      // Add to appropriate buffer
      if (audioData.channel === 'external') {
        this.externalBuffer.addAudioData(float32Data);
      } else {
        this.systemBuffer.addAudioData(float32Data);
      }
      
    } catch (error) {
      console.error('❌ Error handling audio data:', error);
      this.onErrorCallback?.(error as Error, 'audio-processing');
    }
  }

  /**
   * Handle transcription results
   */
  private handleTranscriptionResult(result: TranscriptionResult): void {
    try {
      console.log(`📝 WASAPI Handler received: ${result.speaker}: "${result.text}" (${result.isFinal ? 'final' : 'interim'})`);
      
      // Create ChatMessage directly for better control
      const chatMessage: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: result.text,
        timestamp: new Date(result.timestamp).toISOString(),
        speaker: result.speaker === 'interviewer' ? 'external' : (result.speaker === 'me' ? 'user' : 'system'),
        isInterim: !result.isFinal
      };
      
      console.log(`📤 WASAPI Handler sending to UI: ${chatMessage.speaker}: "${chatMessage.text}"`);
      
      // For interim results, always notify (for real-time display)
      if (!result.isFinal) {
        // Always show interim results for real-time feedback
        this.onTranscriptionCallback?.(chatMessage);
      } else {
        // For final results, use transcription manager to prevent duplicates
        const shouldAdd = transcriptionManager.shouldAddTranscript(result.text, result.isFinal, chatMessage.speaker);
        console.log(`📊 Should add transcript: ${shouldAdd} for "${result.text}"`);
        
        if (shouldAdd) {
          // Send the chatMessage directly instead of getting from manager
          console.log(`✅ Sending final transcript to UI: "${chatMessage.text}"`);
          this.onTranscriptionCallback?.(chatMessage);
        } else {
          console.log(`⏭️ Skipping duplicate transcript: "${result.text}"`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error handling transcription result:', error);
      this.onErrorCallback?.(error as Error, 'transcription-processing');
    }
  }

  /**
   * Start audio streaming to Deepgram
   */
  private startAudioStreaming(): void {
    const streamingInterval = 100; // Stream every 100ms
    
    this.streamingInterval = setInterval(() => {
      try {
        // Process system audio buffer only
        const systemData = this.systemBuffer.getBufferedData();
        if (systemData.length > 0) {
          const converted = AudioConverter.processForDeepgram(systemData);
          this.getDeepgramClient().sendAudioData(converted.buffer, 'system');
          this.systemBuffer.clear();
        }
        
      } catch (error) {
        console.error('❌ Error streaming audio:', error);
        this.onErrorCallback?.(error as Error, 'audio-streaming');
      }
    }, streamingInterval);
  }

  /**
   * Start status updates
   */
  private startStatusUpdates(): void {
    this.statusUpdateInterval = setInterval(() => {
      const status = this.getStatus();
      this.onStatusUpdateCallback?.(status);
    }, 1000); // Update every second
  }

  /**
   * Get current system status
   */
  getStatus(): DualChannelStatus {
    const deepgramStatus = this.getDeepgramClient().getConnectionStatus();
    const wasapiCapturing = wasapiManager.isCapturingAudio();
    const deepgramTranscribing = this.getDeepgramClient().isTranscribingActive();
    
    const now = Date.now();
    
    return {
      external: {
        capturing: wasapiCapturing,
        transcribing: deepgramTranscribing,
        connected: deepgramStatus.external,
        audioLevel: this.currentAudioLevels.external,
        lastActivity: this.lastActivityTime.external
      },
      system: {
        capturing: wasapiCapturing,
        transcribing: deepgramTranscribing,
        connected: deepgramStatus.system,
        audioLevel: this.currentAudioLevels.system,
        lastActivity: this.lastActivityTime.system
      },
      overall: {
        active: this.isActive,
        startTime: this.startTime,
        totalDuration: this.startTime ? now - this.startTime : 0
      }
    };
  }

  /**
   * Get current audio levels
   */
  getAudioLevels(): AudioLevels {
    return { ...this.currentAudioLevels };
  }

  /**
   * Check if system is active
   */
  isSystemActive(): boolean {
    return this.isActive;
  }

  /**
   * Get transcription history
   */
  getTranscriptionHistory(): ChatMessage[] {
    return transcriptionManager.getMessages();
  }

  /**
   * Clear transcription history
   */
  clearTranscriptionHistory(): void {
    transcriptionManager.reset();
  }

  /**
   * Restart specific channel
   */
  async restartChannel(channel: 'external' | 'system'): Promise<void> {
    console.log(`🔄 Restarting ${channel} channel...`);
    
    try {
      // Reconnect Deepgram for this channel
      await this.getDeepgramClient().reconnectChannel(channel);
      console.log(`✅ ${channel} channel restarted`);
      
    } catch (error) {
      console.error(`❌ Failed to restart ${channel} channel:`, error);
      this.onErrorCallback?.(error as Error, `restart-${channel}`);
      throw error;
    }
  }

  /**
   * Update Deepgram configuration
   */
  updateDeepgramConfig(config: any): void {
    this.getDeepgramClient().updateConfig(config);
  }

  /**
   * Set callback for transcription events
   */
  onTranscription(callback: (message: ChatMessage) => void): void {
    this.onTranscriptionCallback = callback;
  }

  /**
   * Set callback for status updates
   */
  onStatusUpdate(callback: (status: DualChannelStatus) => void): void {
    this.onStatusUpdateCallback = callback;
  }

  /**
   * Set callback for audio level updates
   */
  onAudioLevels(callback: (levels: AudioLevels) => void): void {
    this.onAudioLevelsCallback = callback;
  }

  /**
   * Set callback for errors
   */
  onError(callback: (error: Error, source: string) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Get system statistics
   */
  getStatistics(): {
    wasapi: { capturing: boolean };
    deepgram: any;
    buffers: {
      external: { size: number; duration: number };
      system: { size: number; duration: number };
    };
    uptime: number;
  } {
    return {
      wasapi: {
        capturing: wasapiManager.isCapturingAudio()
      },
      deepgram: this.getDeepgramClient().getStatistics(),
      buffers: {
        external: {
          size: this.externalBuffer.getBufferSize(),
          duration: this.externalBuffer.getBufferDuration()
        },
        system: {
          size: this.systemBuffer.getBufferSize(),
          duration: this.systemBuffer.getBufferDuration()
        }
      },
      uptime: this.startTime ? Date.now() - this.startTime : 0
    };
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    console.log('🧹 Disposing WASAPI + Deepgram Handler...');
    
    await this.stop();
    
    // Dispose individual components
    await wasapiManager.dispose();
    await this.getDeepgramClient().dispose();
    
    // Clear callbacks
    this.onTranscriptionCallback = undefined;
    this.onStatusUpdateCallback = undefined;
    this.onAudioLevelsCallback = undefined;
    this.onErrorCallback = undefined;
    
    this.isInitialized = false;
    console.log('✅ WASAPI + Deepgram Handler disposed');
  }

  /**
   * Get Deepgram client, initializing if needed
   */
  private getDeepgramClient() {
    if (!this.dualChannelDeepgram) {
      this.dualChannelDeepgram = dualChannelDeepgram;
      this.setupEventHandlers();
    }
    return this.dualChannelDeepgram;
  }
}

// Export singleton instance
export const wasapiDeepgramHandler = new WASAPIDeepgramHandler();
