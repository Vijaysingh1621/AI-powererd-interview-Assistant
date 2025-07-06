/**
 * Simple Deepgram Client for Real-time Transcription
 * Single audio source transcription with simplified interface
 */

import { CreateProjectKeyResponse, LiveClient, LiveTranscriptionEvents, createClient } from "@deepgram/sdk";

export interface SimpleTranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
  timestamp: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export class SimpleDeepgramClient {
  private apiKey: string | null = null;
  private connection: LiveClient | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Configuration
  private config = {
    model: "nova-2",
    language: "en-US",
    punctuate: true,
    diarize: false,
    smart_format: true,
    interim_results: true,
    endpointing: 300,
    vad_events: true,
    channels: 1,
    sample_rate: 16000
  };

  // Callbacks
  private onTranscriptionCallback?: (result: SimpleTranscriptionResult) => void;
  private onErrorCallback?: (error: Error) => void;
  private onStatusChangeCallback?: (status: ConnectionStatus) => void;

  constructor() {
    console.log('🎯 SimpleDeepgramClient created');
  }

  /**
   * Initialize Deepgram API key
   */
  private async initializeApiKey(): Promise<void> {
    try {
      console.log('🔑 Initializing Deepgram API key...');
      
      if (typeof window === 'undefined') {
        throw new Error('SimpleDeepgramClient can only be used in browser environment');
      }
      
      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      
      if (!apiKey) {
        throw new Error('NEXT_PUBLIC_DEEPGRAM_API_KEY not found in environment variables');
      }
      
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
   * Connect to Deepgram
   */
  async connect(): Promise<void> {
    try {
      await this.ensureInitialized();
      
      if (this.connection) {
        console.log('⚠️ Already connected to Deepgram');
        return;
      }

      this.updateStatus('connecting');
      console.log('🔌 Connecting to Deepgram...');

      const deepgram = createClient(this.apiKey!);
      this.connection = deepgram.listen.live(this.config);

      this.setupEventHandlers();
      this.startHealthMonitoring();

      console.log('✅ Connected to Deepgram');
      this.updateStatus('connected');

    } catch (error) {
      console.error('❌ Failed to connect to Deepgram:', error);
      this.updateStatus('error');
      this.onErrorCallback?.(error instanceof Error ? error : new Error('Failed to connect'));
      throw error;
    }
  }

  /**
   * Disconnect from Deepgram
   */
  async disconnect(): Promise<void> {
    try {
      console.log('🔌 Disconnecting from Deepgram...');
      
      this.stopHealthMonitoring();
      
      if (this.connection) {
        this.connection.finish();
        this.connection = null;
      }

      this.updateStatus('disconnected');
      console.log('✅ Disconnected from Deepgram');

    } catch (error) {
      console.error('❌ Error disconnecting from Deepgram:', error);
      this.onErrorCallback?.(error instanceof Error ? error : new Error('Disconnect error'));
    }
  }

  /**
   * Send audio data to Deepgram
   */
  send(audioData: Uint8Array): void {
    if (!this.connection) {
      console.warn('⚠️ Cannot send audio: not connected to Deepgram');
      return;
    }

    try {
      this.connection.send(audioData.buffer);
    } catch (error) {
      console.error('❌ Error sending audio data:', error);
      this.onErrorCallback?.(error instanceof Error ? error : new Error('Send error'));
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected' && this.connection !== null;
  }

  /**
   * Get current status
   */
  getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Setup event handlers for Deepgram connection
   */
  private setupEventHandlers(): void {
    if (!this.connection) return;

    // Handle transcription results
    this.connection.addListener(LiveTranscriptionEvents.Transcript, (data: any) => {
      try {
        const transcript = data.channel?.alternatives?.[0];
        if (transcript && transcript.transcript) {
          const result: SimpleTranscriptionResult = {
            text: transcript.transcript,
            isFinal: data.is_final || false,
            confidence: transcript.confidence,
            timestamp: Date.now()
          };

          this.onTranscriptionCallback?.(result);
        }
      } catch (error) {
        console.error('❌ Error processing transcript:', error);
        this.onErrorCallback?.(error instanceof Error ? error : new Error('Transcript processing error'));
      }
    });

    // Handle connection opened
    this.connection.addListener(LiveTranscriptionEvents.Open, () => {
      console.log('🎯 Deepgram connection opened');
      this.updateStatus('connected');
    });

    // Handle connection closed
    this.connection.addListener(LiveTranscriptionEvents.Close, () => {
      console.log('🔌 Deepgram connection closed');
      this.updateStatus('disconnected');
    });

    // Handle errors
    this.connection.addListener(LiveTranscriptionEvents.Error, (error: any) => {
      console.error('❌ Deepgram connection error:', error);
      this.updateStatus('error');
      this.onErrorCallback?.(new Error(error.message || 'Deepgram connection error'));
    });

    // Handle metadata
    this.connection.addListener(LiveTranscriptionEvents.Metadata, (data: any) => {
      console.log('📊 Deepgram metadata:', data);
    });
  }

  /**
   * Update connection status
   */
  private updateStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.onStatusChangeCallback?.(status);
    }
  }

  /**
   * Start connection health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      if (this.connection && this.connectionStatus === 'connected') {
        // Send a small keepalive packet
        try {
          // Send empty buffer as keepalive
          this.connection.send(new ArrayBuffer(0));
        } catch (error) {
          console.warn('⚠️ Health check failed:', error);
          this.updateStatus('error');
        }
      }
    }, 30000); // Check every 30 seconds

    console.log('💓 Connection health monitoring started');
  }

  /**
   * Stop connection health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('💓 Connection health monitoring stopped');
    }
  }

  // Event handler setters
  onTranscript(callback: (result: SimpleTranscriptionResult) => void): void {
    this.onTranscriptionCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.onStatusChangeCallback = callback;
  }
}

// Browser-only singleton export
export const deepgramClient = typeof window !== 'undefined' ? new SimpleDeepgramClient() : ({} as any);
