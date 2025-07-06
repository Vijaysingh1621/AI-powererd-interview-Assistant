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
  private healthCheckInterval: NodeJS.Timeout | null = null;

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
   * Connect to Deepgram for system audio transcription only
   */
  async connect(): Promise<void> {
    await this.ensureInitialized();

    try {
      console.log('🔌 Connecting to Deepgram for system audio...');
      
      // Connect system channel only (interviewer audio)
      await this.connectChannel('system');
      
      this.isConnected = true;
      console.log('✅ System audio Deepgram connection established');
      
    } catch (error) {
      console.error('❌ Failed to connect to Deepgram:', error);
      this.onErrorCallback?.(error as Error, 'system');
      throw error;
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
        channels: channel === 'system' ? 2 : 1, // System audio is stereo, external is mono
        sample_rate: 48000,
        encoding: "linear16",
        // Add additional parameters for better transcription
        diarize: false,
        filler_words: false,
        multichannel: channel === 'system', // Enable multichannel for system audio
        alternatives: 1,
        profanity_filter: false,
        redact: [],
        utterance_end_ms: 1000,
        vad_events: true
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
      console.log(`🎧 Deepgram ${channel} raw data (type: ${data.type}, is_final: ${data.is_final}):`, JSON.stringify(data, null, 2));
      
      // Don't skip interim results - let's process everything to understand what we're getting
      
      // Try multiple ways to extract transcript from Deepgram response
      let transcript = '';
      let confidence = 0;
      let extractionMethod = '';
      
      // Debug: Log the channel object specifically
      console.log(`🔍 Channel object:`, JSON.stringify(data.channel, null, 2));
      console.log(`🔍 Direct alternatives:`, JSON.stringify(data.alternatives, null, 2));
      console.log(`🔍 Channel alternatives check:`, !!data.channel?.alternatives);
      console.log(`🔍 Channel alternatives length:`, data.channel?.alternatives?.length);
      console.log(`🔍 First alternative:`, JSON.stringify(data.channel?.alternatives?.[0], null, 2));
      
      // Method 1: Check channel alternatives (check for property existence, not just truthiness)
      if (data.channel?.alternatives?.[0] && 'transcript' in data.channel.alternatives[0]) {
        transcript = data.channel.alternatives[0].transcript || '';
        confidence = data.channel.alternatives[0].confidence || 0;
        extractionMethod = 'Method 1 - channel.alternatives';
        console.log(`✅ Method 1 found transcript property: transcript="${transcript}", confidence=${confidence}, isEmpty=${transcript === ''}`);
      }
      // Method 1b: Manual check for the exact structure we see in logs
      else if (data.channel && data.channel.alternatives && Array.isArray(data.channel.alternatives) && data.channel.alternatives.length > 0) {
        const alt = data.channel.alternatives[0];
        if (alt && alt.transcript) {
          transcript = alt.transcript;
          confidence = alt.confidence || 0;
          extractionMethod = 'Method 1b - manual channel.alternatives';
          console.log(`✅ Method 1b success: transcript="${transcript}", confidence=${confidence}`);
        }
      }
      // Method 2: Check direct alternatives array
      else if (data.alternatives?.[0]?.transcript) {
        transcript = data.alternatives[0].transcript;
        confidence = data.alternatives[0].confidence || 0;
        extractionMethod = 'Method 2 - direct alternatives';
      }
      // Method 3: Check if transcript is directly in data
      else if (data.transcript) {
        transcript = data.transcript;
        confidence = data.confidence || 0;
        extractionMethod = 'Method 3 - direct transcript';
      }
      // Method 4: Check results.channels array (common format)
      else if (data.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
        transcript = data.results.channels[0].alternatives[0].transcript;
        confidence = data.results.channels[0].alternatives[0].confidence || 0;
        extractionMethod = 'Method 4 - results.channels';
      }
      // Method 5: Check if there are any nested alternatives anywhere
      else if (data.results && Array.isArray(data.results)) {
        for (const result of data.results) {
          if (result.alternatives?.[0]?.transcript) {
            transcript = result.alternatives[0].transcript;
            confidence = result.alternatives[0].confidence || 0;
            extractionMethod = 'Method 5 - nested results array';
            break;
          }
          // Also check for channels within each result
          if (result.channels?.[0]?.alternatives?.[0]?.transcript) {
            transcript = result.channels[0].alternatives[0].transcript;
            confidence = result.channels[0].alternatives[0].confidence || 0;
            extractionMethod = 'Method 5b - result.channels';
            break;
          }
        }
      }
      // Method 6: Check for multichannel format with channel_index (NEW - this might be the key!)
      else if (data.channel_index && Array.isArray(data.channel_index)) {
        console.log(`🔍 Processing multichannel response with ${data.channel_index.length} channels`);
        // For multichannel responses, check each channel
        for (let i = 0; i < data.channel_index.length; i++) {
          console.log(`🔍 Checking channel ${i}:`, data.channel_index[i]);
          
          // Try multiple ways to access channel data
          let channelData = null;
          
          // Method 6a: data.channel_N format
          if (data[`channel_${i}`]) {
            channelData = data[`channel_${i}`];
            console.log(`Found channel data at channel_${i}:`, channelData);
          }
          // Method 6b: data.channels[i] format  
          else if (data.channels && data.channels[i]) {
            channelData = data.channels[i];
            console.log(`Found channel data at channels[${i}]:`, channelData);
          }
          // Method 6c: Check if data itself has alternatives for this channel
          else if (i === 0 && data.alternatives) {
            channelData = data;
            console.log(`Using root data as channel ${i} data:`, channelData);
          }
          
          if (channelData?.alternatives?.[0]?.transcript) {
            transcript = channelData.alternatives[0].transcript;
            confidence = channelData.alternatives[0].confidence || 0;
            extractionMethod = `Method 6 - multichannel channel_${i}`;
            console.log(`✅ Found transcript in channel ${i}: "${transcript}"`);
            break;
          }
        }
      }
      // Method 7: Deep search for any transcript content
      else {
        const findTranscriptRecursive = (obj: any, path = ''): { transcript: string; confidence: number; path: string } | null => {
          if (!obj || typeof obj !== 'object') return null;
          
          // Check if current object has alternatives
          if (obj.alternatives && Array.isArray(obj.alternatives) && obj.alternatives[0]?.transcript) {
            return {
              transcript: obj.alternatives[0].transcript,
              confidence: obj.alternatives[0].confidence || 0,
              path: `${path}.alternatives[0]`
            };
          }
          
          // Check if current object has transcript directly
          if (obj.transcript && typeof obj.transcript === 'string' && obj.transcript.trim()) {
            return {
              transcript: obj.transcript,
              confidence: obj.confidence || 0,
              path: path
            };
          }
          
          // Recursively search nested objects and arrays
          for (const [key, value] of Object.entries(obj)) {
            const result = findTranscriptRecursive(value, path ? `${path}.${key}` : key);
            if (result) return result;
          }
          
          return null;
        };
        
        const result = findTranscriptRecursive(data);
        if (result) {
          transcript = result.transcript;
          confidence = result.confidence;
          extractionMethod = `Method 7 - recursive search at ${result.path}`;
        }
      }

      if (extractionMethod) {
        console.log(`✅ ${extractionMethod} - Found transcript property: "${transcript}" (empty: ${transcript === ''}, final: ${data.is_final})`);
        
        // Only process non-empty transcripts OR final results (even if empty, for debugging)
        if (transcript.trim() || data.is_final) {
          const transcriptionResult: TranscriptionResult = {
            text: transcript.trim(),
            isFinal: data.is_final || false,
            confidence: confidence,
            channel: channel,
            timestamp: Date.now(),
            speaker: 'interviewer' // All system audio is from interviewer
          };

          console.log(`🎧 Deepgram ${channel} transcription result:`, transcriptionResult);
          
          // Only send to UI if there's actual text content
          if (transcript.trim()) {
            console.log(`📞 Calling onTranscriptionCallback for ${channel}:`, !!this.onTranscriptionCallback);
            
            if (this.onTranscriptionCallback) {
              this.onTranscriptionCallback(transcriptionResult);
              console.log(`✅ Successfully called onTranscriptionCallback for ${channel} with text: "${transcript}"`);
            } else {
              console.error(`❌ No onTranscriptionCallback set for ${channel}!`);
            }
          } else {
            console.log(`⏸️ Empty transcript for ${channel}, not sending to UI (final: ${data.is_final})`);
          }
        } else {
          console.log(`⏸️ Skipping empty interim transcript for ${channel}`);
        }
      } else {
        console.log(`🎧 Deepgram ${channel} received data but no transcript found. Full analysis:`, {
          dataType: data.type,
          hasChannel: !!data.channel,
          hasAlternatives: !!data.alternatives,
          hasDirectTranscript: !!data.transcript,
          hasChannelIndex: !!data.channel_index,
          channelIndexLength: data.channel_index?.length || 0,
          channelIndexValues: data.channel_index,
          hasResults: !!data.results,
          resultsType: Array.isArray(data.results) ? 'array' : typeof data.results,
          resultsLength: Array.isArray(data.results) ? data.results.length : 'N/A',
          hasResultsChannels: !!data.results?.channels,
          resultsChannelsLength: data.results?.channels?.length || 0,
          isFinal: data.is_final,
          duration: data.duration,
          start: data.start,
          dataKeys: Object.keys(data),
          // Check all possible transcript locations
          possibleTranscripts: {
            'channel.alternatives[0].transcript': data.channel?.alternatives?.[0]?.transcript,
            'alternatives[0].transcript': data.alternatives?.[0]?.transcript,
            'transcript': data.transcript,
            'results.channels[0].alternatives[0].transcript': data.results?.channels?.[0]?.alternatives?.[0]?.transcript,
            'results[0].alternatives[0].transcript': data.results?.[0]?.alternatives?.[0]?.transcript,
            'results[0].channels[0].alternatives[0].transcript': data.results?.[0]?.channels?.[0]?.alternatives?.[0]?.transcript
          },
          fullDataSample: JSON.stringify(data, null, 2).substring(0, 1000) + '...'
        });
        
        // Additional debug: try to find ANY string that might be a transcript
        const findAllStrings = (obj: any, path = '', strings: { path: string; value: string }[] = []): { path: string; value: string }[] => {
          if (typeof obj === 'string' && obj.trim().length > 0) {
            strings.push({ path, value: obj });
          } else if (obj && typeof obj === 'object') {
            for (const [key, value] of Object.entries(obj)) {
              findAllStrings(value, path ? `${path}.${key}` : key, strings);
            }
          }
          return strings;
        };
        
        const allStrings = findAllStrings(data);
        const potentialTranscripts = allStrings.filter(s => 
          s.value.length > 2 && 
          !s.path.includes('type') && 
          !s.path.includes('request_id') &&
          !s.path.includes('model_uuid') &&
          s.value !== 'Results'
        );
        
        console.log(`🔍 Potential transcript strings found:`, potentialTranscripts);
      }
    });

    // Error handling
    connection.addListener(LiveTranscriptionEvents.Error, (error) => {
      console.error(`❌ ${channel} transcription error:`, error);
      this.onErrorCallback?.(error, channel);
    });

    // Connection status
    connection.addListener(LiveTranscriptionEvents.Close, (event) => {
      console.log(`🔌 ${channel} connection closed:`, {
        code: event?.code,
        reason: event?.reason,
        wasClean: event?.wasClean
      });
      this.onConnectionStatusCallback?.('disconnected', channel);
      
      // Clear the connection reference
      if (channel === 'external') {
        this.externalConnection = null;
      } else {
        this.systemConnection = null;
      }
      
      // Auto-reconnect if we were supposed to be transcribing
      if (this.isTranscribing && this.isConnected) {
        console.log(`🔄 Auto-reconnecting ${channel} channel...`);
        setTimeout(() => {
          this.reconnectChannel(channel).catch(error => {
            console.error(`❌ Auto-reconnect failed for ${channel}:`, error);
          });
        }, 2000); // Wait 2 seconds before reconnecting
      }
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
   * Start transcription for system audio
   */
  async startTranscription(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      console.log('🎤 Starting system audio transcription...');
      this.isTranscribing = true;
      
      // Start connection health monitoring
      this.startHealthMonitoring();
      
      console.log('✅ System audio transcription started');
      
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
        // Validate audio data
        if (audioData.byteLength === 0) {
          console.warn(`⚠️ Empty audio buffer for ${channel}, skipping`);
          return;
        }
        
        // Check for actual audio content (not just silence)
        const int16View = new Int16Array(audioData);
        let hasNonZeroSamples = false;
        let maxSample = 0;
        
        for (let i = 0; i < Math.min(100, int16View.length); i++) {
          const sample = Math.abs(int16View[i]);
          maxSample = Math.max(maxSample, sample);
          if (sample > 100) { // Threshold for non-silence
            hasNonZeroSamples = true;
          }
        }
        
        console.log(`🎵 Sending ${channel} audio: ${audioData.byteLength} bytes, max sample: ${maxSample}, has audio: ${hasNonZeroSamples}`);
        // Send ArrayBuffer directly to Deepgram
        connection.send(audioData);
      } else {
        const readyState = connection?.getReadyState() || -1;
        const stateNames = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
        const stateName = stateNames[readyState] || 'UNKNOWN';
        
        console.warn(`⚠️ Cannot send audio to ${channel}: connection not ready (state: ${readyState} = ${stateName})`);
        
        // If connection is closed and we should be transcribing, try to reconnect
        if (readyState === 3 && this.isTranscribing) { // CLOSED
          console.log(`🔄 Connection closed for ${channel}, attempting reconnection...`);
          this.reconnectChannel(channel).catch(error => {
            console.error(`❌ Failed to reconnect ${channel}:`, error);
          });
        }
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
    console.log('🛑 Stopping system audio transcription...');
    
    try {
      this.isTranscribing = false;
      
      // Stop health monitoring
      this.stopHealthMonitoring();

      // Close system connection only
      if (this.systemConnection) {
        this.systemConnection.requestClose();
        this.systemConnection = null;
      }

      this.isConnected = false;
      console.log('✅ System audio transcription stopped');
      
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

  /**
   * Check and maintain connection health
   */
  private checkConnectionHealth(): void {
    if (!this.isTranscribing) return;
    
    const systemState = this.systemConnection?.getReadyState() || -1;
    
    // If system connection is closed, try to reconnect
    if (systemState === 3) { // CLOSED
      console.log(`🔧 System connection health check: reconnecting...`);
      this.reconnectChannel('system').catch(error => {
        console.error(`❌ Health check reconnection failed for system:`, error);
      });
    }
  }

  /**
   * Start connection health monitoring
   */
  private startHealthMonitoring(): void {
    // Check connection health every 5 seconds
    this.healthCheckInterval = setInterval(() => {
      this.checkConnectionHealth();
    }, 5000);
    
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
}

// Browser-only singleton export
export const dualChannelDeepgram = typeof window !== 'undefined' ? new DualChannelDeepgramClient() : ({} as any);
