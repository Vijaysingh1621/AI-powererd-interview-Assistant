/**
 * Dual-Channel Deepgram Client for Real-time Transcription
 * Handles separate transcription streams for Interviewer and Me
 */

import { CreateProjectKeyResponse, LiveClient, LiveTranscriptionEvents, createClient } from "@deepgram/sdk";

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence: number;
  channel: 'external' | 'system';
  timestamp: number;
  speaker: 'interviewer' | 'me';
}

export interface DeepgramConfig {
  model: string;
  language: string;
  punctuate: boolean;
  diarize: boolean;
  smart_format: boolean;
  interim_results: boolean;
  endpointing: number;
  vad_events: boolean;
}

export class DualChannelDeepgramClient {
  private apiKey: string | null = null;
  private externalConnection: LiveClient | null = null;
  private systemConnection: LiveClient | null = null;
  private isConnected = false;
  private isTranscribing = false;

  // Configuration
  private config: DeepgramConfig = {
    model: "nova-2",
    language: "en-US",
    punctuate: true,
    diarize: false,
    smart_format: true,
    interim_results: true,
    endpointing: 300,
    vad_events: true
  };

  // Callbacks
  private onTranscriptionCallback?: (result: TranscriptionResult) => void;
  private onErrorCallback?: (error: Error, channel: 'external' | 'system') => void;
  private onConnectionStatusCallback?: (status: 'connected' | 'disconnected' | 'error', channel: 'external' | 'system') => void;

  constructor() {
    // Don't initialize API key here - do it lazily when needed
    console.log('🎯 DualChannelDeepgramClient created (API key will be loaded when needed)');
  }

  /**
   * Initialize Deepgram API key
   */
  private async initializeApiKey(): Promise<void> {
    try {
      console.log('🔑 Initializing Deepgram API key...');
      
      // Check if we're in the browser environment
      if (typeof window === 'undefined') {
        throw new Error('DualChannelDeepgramClient can only be used in browser environment');
      }
      
      // Use the client-side environment variable directly
      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      
      if (!apiKey) {
        throw new Error('NEXT_PUBLIC_DEEPGRAM_API_KEY not found in environment variables');
      }
      
      // Store the API key directly
      this.apiKey = apiKey;
      
      console.log('✅ Deepgram API key initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Deepgram API key:', error);
      throw error;
    }
  }

  /**
   * Ensure API key is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.apiKey) {
      await this.initializeApiKey();
    }
  }

  /**
   * Connect to Deepgram for dual-channel transcription
   */
  async connect(): Promise<void> {
    await this.ensureInitialized();

    try {
      console.log('🔌 Connecting to Deepgram dual-channel...');
      
      // Connect external channel first (microphone)
      await this.connectChannel('external');
      
      // Wait a moment before connecting second channel to avoid overwhelming the connection
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Connect system channel (system audio)
      await this.connectChannel('system');
      
      this.isConnected = true;
      console.log('✅ Dual-channel Deepgram connection established');
      
    } catch (error) {
      console.error('❌ Failed to connect to Deepgram:', error);
      
      // If dual-channel fails, try single channel (external only)
      console.log('🔄 Attempting single-channel connection (external only)...');
      try {
        await this.connectChannel('external');
        this.isConnected = true;
        console.log('✅ Single-channel Deepgram connection established (external only)');
      } catch (singleChannelError) {
        console.error('❌ Single-channel connection also failed:', singleChannelError);
        this.onErrorCallback?.(error as Error, 'external');
        throw error;
      }
    }
  }

  /**
   * Connect specific channel with retry logic
   */
  private async connectChannel(channel: 'external' | 'system', retryCount: number = 0): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Deepgram API key not available');
    }

    const maxRetries = 3;
    const retryDelay = 1000 * (retryCount + 1); // Progressive delay: 1s, 2s, 3s

    try {
      console.log(`🔌 Connecting ${channel} channel... (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      const client = createClient(this.apiKey);
      const connection = client.listen.live({
        model: "nova-2",
        language: "en-US",
        punctuate: true,
        interim_results: true,
        endpointing: 300,
        smart_format: true,
        channels: 1,
        sample_rate: 48000,
        encoding: "linear16"
      });

      // Setup event listeners
      this.setupChannelEventListeners(connection, channel);

      // Wait for connection to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error(`❌ ${channel} channel connection timeout`);
          reject(new Error(`${channel} channel connection timeout`));
        }, 15000); // Increased timeout to 15 seconds

        connection.addListener(LiveTranscriptionEvents.Open, () => {
          clearTimeout(timeout);
          console.log(`✅ ${channel} channel connected`);
          this.onConnectionStatusCallback?.('connected', channel);
          resolve();
        });

        connection.addListener(LiveTranscriptionEvents.Error, (error) => {
          clearTimeout(timeout);
          console.error(`❌ ${channel} channel connection error:`, error);
          console.error(`❌ ${channel} channel error details:`, {
            message: error.message || 'Unknown error',
            type: error.type || 'Unknown type',
            code: error.code || 'No code',
            readyState: connection.getReadyState()
          });
          this.onConnectionStatusCallback?.('error', channel);
          reject(error);
        });

        connection.addListener(LiveTranscriptionEvents.Close, (event) => {
          clearTimeout(timeout);
          console.error(`❌ ${channel} channel closed during connection:`, {
            code: event?.code || 'No code',
            reason: event?.reason || 'No reason',
            wasClean: event?.wasClean || false
          });
          reject(new Error(`${channel} channel closed during connection: ${event?.reason || 'Unknown reason'}`));
        });
      });

      // Store connection
      if (channel === 'external') {
        this.externalConnection = connection;
      } else {
        this.systemConnection = connection;
      }

    } catch (error) {
      console.error(`❌ Failed to connect ${channel} channel (attempt ${retryCount + 1}):`, error);
      
      // Retry logic
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying ${channel} channel connection in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.connectChannel(channel, retryCount + 1);
      } else {
        console.error(`❌ Failed to connect ${channel} channel after ${maxRetries + 1} attempts`);
        throw error;
      }
    }
  }

  /**
   * Setup event listeners for a channel
   */
  private setupChannelEventListeners(connection: LiveClient, channel: 'external' | 'system'): void {
    // Transcription results
    connection.addListener(LiveTranscriptionEvents.Transcript, (data) => {
      console.log(`🎧 Deepgram ${channel} raw data:`, data);
      
      // Try multiple ways to extract transcript from Deepgram response
      let transcript = '';
      let confidence = 0;
      
      // Method 1: Check channel alternatives (most common)
      if (data.channel?.alternatives?.[0]?.transcript) {
        transcript = data.channel.alternatives[0].transcript;
        confidence = data.channel.alternatives[0].confidence || 0;
      }
      // Method 2: Check direct alternatives array
      else if (data.alternatives?.[0]?.transcript) {
        transcript = data.alternatives[0].transcript;
        confidence = data.alternatives[0].confidence || 0;
      }
      // Method 3: Check if transcript is directly in data
      else if (data.transcript) {
        transcript = data.transcript;
        confidence = data.confidence || 0;
      }
      // Method 4: Check channel_index array for multi-channel results
      else if (data.channel_index && Array.isArray(data.channel_index)) {
        for (const channelData of data.channel_index) {
          if (channelData?.alternatives?.[0]?.transcript) {
            transcript = channelData.alternatives[0].transcript;
            confidence = channelData.alternatives[0].confidence || 0;
            break;
          }
        }
      }
      
      if (transcript && transcript.trim()) {
        const transcriptionResult: TranscriptionResult = {
          text: transcript.trim(),
          isFinal: data.is_final || false,
          confidence: confidence,
          channel: channel,
          timestamp: Date.now(),
          speaker: channel === 'external' ? 'interviewer' : 'me'
        };

        console.log(`🎧 Deepgram ${channel} transcription result:`, transcriptionResult);
        this.onTranscriptionCallback?.(transcriptionResult);
      } else {
        console.log(`🎧 Deepgram ${channel} received data but no transcript found:`, {
          hasChannel: !!data.channel,
          hasAlternatives: !!data.alternatives,
          hasDirectTranscript: !!data.transcript,
          hasChannelIndex: !!data.channel_index,
          channelIndexLength: data.channel_index?.length || 0,
          rawData: data
        });
      }
    });

    // Error handling
    connection.addListener(LiveTranscriptionEvents.Error, (error) => {
      console.error(`❌ ${channel} transcription error:`, error);
      this.onErrorCallback?.(error, channel);
    });

    // Connection status
    connection.addListener(LiveTranscriptionEvents.Close, () => {
      console.log(`🔌 ${channel} connection closed`);
      this.onConnectionStatusCallback?.('disconnected', channel);
    });

    // Metadata events
    connection.addListener(LiveTranscriptionEvents.Metadata, (data) => {
      console.log(`📊 ${channel} metadata:`, data);
    });

    // Voice Activity Detection
    connection.addListener(LiveTranscriptionEvents.SpeechStarted, () => {
      console.log(`🗣️ ${channel} speech started`);
    });

    connection.addListener(LiveTranscriptionEvents.UtteranceEnd, () => {
      console.log(`🔚 ${channel} utterance ended`);
    });
  }

  /**
   * Start transcription for both channels
   */
  async startTranscription(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      console.log('🎤 Starting dual-channel transcription...');
      this.isTranscribing = true;
      console.log('✅ Dual-channel transcription started');
      
    } catch (error) {
      console.error('❌ Failed to start transcription:', error);
      throw error;
    }
  }

  /**
   * Send audio data to specific channel
   */
  sendAudioData(audioData: ArrayBuffer, channel: 'external' | 'system'): void {
    if (!this.isTranscribing) {
      console.log(`⏸️ Not transcribing, skipping audio data for ${channel}`);
      return;
    }

    try {
      const connection = channel === 'external' ? this.externalConnection : this.systemConnection;
      
      if (connection && connection.getReadyState() === 1) { // OPEN
        console.log(`🎵 Sending ${audioData.byteLength} bytes to ${channel} channel`);
        // Send ArrayBuffer directly to Deepgram
        connection.send(audioData);
      } else {
        const readyState = connection?.getReadyState() || -1;
        console.warn(`⚠️ Cannot send audio to ${channel}: connection not ready (state: ${readyState})`);
      }
    } catch (error) {
      console.error(`❌ Failed to send audio data to ${channel}:`, error);
      this.onErrorCallback?.(error as Error, channel);
    }
  }

  /**
   * Stop transcription
   */
  async stopTranscription(): Promise<void> {
    console.log('🛑 Stopping dual-channel transcription...');
    
    try {
      this.isTranscribing = false;

      // Close external connection
      if (this.externalConnection) {
        this.externalConnection.requestClose();
        this.externalConnection = null;
      }

      // Close system connection
      if (this.systemConnection) {
        this.systemConnection.requestClose();
        this.systemConnection = null;
      }

      this.isConnected = false;
      console.log('✅ Dual-channel transcription stopped');
      
    } catch (error) {
      console.error('❌ Error stopping transcription:', error);
      throw error;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DeepgramConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Deepgram configuration updated:', this.config);
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    external: boolean;
    system: boolean;
    overall: boolean;
  } {
    const externalConnected = this.externalConnection?.getReadyState() === 1;
    const systemConnected = this.systemConnection?.getReadyState() === 1;
    
    return {
      external: externalConnected,
      system: systemConnected,
      overall: externalConnected && systemConnected
    };
  }

  /**
   * Set callback for transcription results
   */
  onTranscription(callback: (result: TranscriptionResult) => void): void {
    this.onTranscriptionCallback = callback;
  }

  /**
   * Set callback for errors
   */
  onError(callback: (error: Error, channel: 'external' | 'system') => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Set callback for connection status
   */
  onConnectionStatus(callback: (status: 'connected' | 'disconnected' | 'error', channel: 'external' | 'system') => void): void {
    this.onConnectionStatusCallback = callback;
  }

  /**
   * Check if transcribing
   */
  isTranscribingActive(): boolean {
    return this.isTranscribing;
  }

  /**
   * Reconnect specific channel
   */
  async reconnectChannel(channel: 'external' | 'system'): Promise<void> {
    console.log(`🔄 Reconnecting ${channel} channel...`);
    
    try {
      // Close existing connection
      const connection = channel === 'external' ? this.externalConnection : this.systemConnection;
      if (connection) {
        connection.requestClose();
      }

      // Wait a moment before reconnecting
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Reconnect
      await this.connectChannel(channel);
      
      console.log(`✅ ${channel} channel reconnected`);
      
    } catch (error) {
      console.error(`❌ Failed to reconnect ${channel} channel:`, error);
      this.onErrorCallback?.(error as Error, channel);
      throw error;
    }
  }

  /**
   * Get transcription statistics
   */
  getStatistics(): {
    external: { connected: boolean; readyState: number };
    system: { connected: boolean; readyState: number };
  } {
    return {
      external: {
        connected: this.externalConnection?.getReadyState() === 1,
        readyState: this.externalConnection?.getReadyState() || -1
      },
      system: {
        connected: this.systemConnection?.getReadyState() === 1,
        readyState: this.systemConnection?.getReadyState() || -1
      }
    };
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    console.log('🧹 Disposing Dual-Channel Deepgram Client...');
    
    await this.stopTranscription();
    
    this.onTranscriptionCallback = undefined;
    this.onErrorCallback = undefined;
    this.onConnectionStatusCallback = undefined;
    
    console.log('✅ Dual-Channel Deepgram Client disposed');
  }
}

// Browser-only singleton export
export const dualChannelDeepgram = typeof window !== 'undefined' ? new DualChannelDeepgramClient() : ({} as any);
