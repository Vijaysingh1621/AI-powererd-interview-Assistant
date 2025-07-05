/**
 * Audio Data Converter for WASAPI to Deepgram
 * Handles audio format conversion and buffering
 */

export interface AudioFormat {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  encoding: 'pcm' | 'float32' | 'linear16';
}

export interface ConvertedAudioData {
  buffer: ArrayBuffer;
  format: AudioFormat;
  timestamp: number;
  duration: number;
}

export class AudioConverter {
  private static readonly TARGET_SAMPLE_RATE = 48000;
  private static readonly TARGET_CHANNELS = 1;
  private static readonly TARGET_BIT_DEPTH = 16;

  /**
   * Convert Float32Array audio data to Linear16 for Deepgram
   */
  static convertToLinear16(
    audioData: Float32Array, 
    sourceSampleRate: number = 48000,
    targetSampleRate: number = 48000
  ): ArrayBuffer {
    let processedData = audioData;

    // Resample if needed
    if (sourceSampleRate !== targetSampleRate) {
      processedData = this.resample(audioData, sourceSampleRate, targetSampleRate);
    }

    // Convert float32 to int16
    const int16Array = new Int16Array(processedData.length);
    for (let i = 0; i < processedData.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit signed integer
      const clamped = Math.max(-1, Math.min(1, processedData[i]));
      int16Array[i] = Math.round(clamped * 32767);
    }

    return int16Array.buffer;
  }

  /**
   * Simple linear interpolation resampling
   */
  private static resample(
    audioData: Float32Array, 
    sourceRate: number, 
    targetRate: number
  ): Float32Array {
    if (sourceRate === targetRate) {
      return audioData;
    }

    const ratio = sourceRate / targetRate;
    const newLength = Math.round(audioData.length / ratio);
    const resampled = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;

      if (index + 1 < audioData.length) {
        // Linear interpolation
        resampled[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
      } else {
        resampled[i] = audioData[index] || 0;
      }
    }

    return resampled;
  }

  /**
   * Convert stereo to mono by averaging channels
   */
  static stereoToMono(stereoData: Float32Array): Float32Array {
    const monoLength = stereoData.length / 2;
    const monoData = new Float32Array(monoLength);

    for (let i = 0; i < monoLength; i++) {
      // Average left and right channels
      monoData[i] = (stereoData[i * 2] + stereoData[i * 2 + 1]) / 2;
    }

    return monoData;
  }

  /**
   * Apply audio preprocessing (normalize, filter noise)
   */
  static preprocessAudio(audioData: Float32Array): Float32Array {
    // Normalize audio
    const normalized = this.normalizeAudio(audioData);
    
    // Apply simple high-pass filter to reduce low-frequency noise
    const filtered = this.highPassFilter(normalized, 0.01);
    
    return filtered;
  }

  /**
   * Normalize audio to prevent clipping
   */
  private static normalizeAudio(audioData: Float32Array): Float32Array {
    let maxAbs = 0;
    for (let i = 0; i < audioData.length; i++) {
      maxAbs = Math.max(maxAbs, Math.abs(audioData[i]));
    }

    if (maxAbs === 0) return audioData;

    const normalized = new Float32Array(audioData.length);
    const scale = 0.95 / maxAbs; // Leave some headroom

    for (let i = 0; i < audioData.length; i++) {
      normalized[i] = audioData[i] * scale;
    }

    return normalized;
  }

  /**
   * Simple high-pass filter
   */
  private static highPassFilter(audioData: Float32Array, alpha: number): Float32Array {
    if (audioData.length === 0) return audioData;

    const filtered = new Float32Array(audioData.length);
    filtered[0] = audioData[0];

    for (let i = 1; i < audioData.length; i++) {
      filtered[i] = alpha * (filtered[i - 1] + audioData[i] - audioData[i - 1]);
    }

    return filtered;
  }

  /**
   * Calculate audio levels (peak and RMS)
   */
  static calculateAudioLevels(audioData: Float32Array): { peak: number; rms: number } {
    let peak = 0;
    let sum = 0;

    for (let i = 0; i < audioData.length; i++) {
      const abs = Math.abs(audioData[i]);
      peak = Math.max(peak, abs);
      sum += abs * abs;
    }

    const rms = Math.sqrt(sum / audioData.length);

    return { peak, rms };
  }

  /**
   * Check if audio contains speech (simple VAD)
   */
  static containsSpeech(audioData: Float32Array, threshold: number = 0.01): boolean {
    const levels = this.calculateAudioLevels(audioData);
    return levels.rms > threshold;
  }

  /**
   * Create audio chunks for streaming
   */
  static createAudioChunks(
    audioData: Float32Array, 
    chunkSize: number = 4800 // 100ms at 48kHz
  ): Float32Array[] {
    const chunks: Float32Array[] = [];
    
    for (let i = 0; i < audioData.length; i += chunkSize) {
      const chunk = audioData.slice(i, i + chunkSize);
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Convert audio data for Deepgram with full processing pipeline
   */
  static processForDeepgram(
    audioData: Float32Array,
    sourceSampleRate: number = 48000,
    channels: number = 1
  ): ConvertedAudioData {
    const startTime = performance.now();

    let processedData = audioData;

    // Convert stereo to mono if needed
    if (channels === 2) {
      processedData = this.stereoToMono(processedData);
    }

    // Preprocess audio
    processedData = this.preprocessAudio(processedData);

    // Convert to Linear16
    const buffer = this.convertToLinear16(processedData, sourceSampleRate, this.TARGET_SAMPLE_RATE);

    const endTime = performance.now();
    const duration = endTime - startTime;

    return {
      buffer,
      format: {
        sampleRate: this.TARGET_SAMPLE_RATE,
        channels: this.TARGET_CHANNELS,
        bitDepth: this.TARGET_BIT_DEPTH,
        encoding: 'linear16'
      },
      timestamp: Date.now(),
      duration
    };
  }

  /**
   * Get optimal chunk size for real-time processing
   */
  static getOptimalChunkSize(sampleRate: number = 48000): number {
    // 100ms chunks for good balance of latency and processing efficiency
    return Math.floor(sampleRate * 0.1);
  }

  /**
   * Validate audio format
   */
  static validateAudioFormat(format: AudioFormat): boolean {
    return (
      format.sampleRate > 0 &&
      format.channels > 0 &&
      format.bitDepth > 0 &&
      ['pcm', 'float32', 'linear16'].includes(format.encoding)
    );
  }
}

/**
 * Audio Buffer Manager for continuous streaming
 */
export class AudioBufferManager {
  private buffer: Float32Array[] = [];
  private maxBufferSize: number;
  private sampleRate: number;

  constructor(maxBufferSizeMs: number = 1000, sampleRate: number = 48000) {
    this.maxBufferSize = Math.floor((maxBufferSizeMs / 1000) * sampleRate);
    this.sampleRate = sampleRate;
  }

  /**
   * Add audio data to buffer
   */
  addAudioData(audioData: Float32Array): void {
    this.buffer.push(audioData);
    this.trimBuffer();
  }

  /**
   * Get buffered audio data
   */
  getBufferedData(): Float32Array {
    if (this.buffer.length === 0) {
      return new Float32Array(0);
    }

    // Calculate total length
    const totalLength = this.buffer.reduce((sum, chunk) => sum + chunk.length, 0);
    
    // Combine all chunks
    const combined = new Float32Array(totalLength);
    let offset = 0;
    
    for (const chunk of this.buffer) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return combined;
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Get buffer size in samples
   */
  getBufferSize(): number {
    return this.buffer.reduce((sum, chunk) => sum + chunk.length, 0);
  }

  /**
   * Get buffer duration in milliseconds
   */
  getBufferDuration(): number {
    return (this.getBufferSize() / this.sampleRate) * 1000;
  }

  /**
   * Trim buffer to max size
   */
  private trimBuffer(): void {
    let totalSize = this.getBufferSize();
    
    while (totalSize > this.maxBufferSize && this.buffer.length > 1) {
      const removed = this.buffer.shift();
      if (removed) {
        totalSize -= removed.length;
      }
    }
  }
}

export default AudioConverter;
