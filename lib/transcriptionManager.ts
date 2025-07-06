/**
 * Utility functions for handling audio transcription and preventing duplicates
 */

import { audioSourceDetector } from './audioSourceDetector';

export interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  speaker: 'user' | 'system' | 'external';
  isInterim?: boolean;
}

export class TranscriptionManager {
  private finalTranscripts: Set<string> = new Set();
  private lastProcessedTime: number = 0;
  private readonly MIN_TIME_BETWEEN_ADDITIONS = 1000; // 1 second minimum between additions
  private readonly MIN_TEXT_LENGTH = 3; // Minimum text length to process
  private messages: ChatMessage[] = [];

  /**
   * Processes a transcript and determines if it should be added
   * @param text The transcript text
   * @param isFinal Whether this is a final transcript from Deepgram
   * @param speaker The speaker type (system, external, user)
   * @returns Whether this text should be added to the transcription
   */
  shouldAddTranscript(text: string, isFinal: boolean = true, speaker: 'user' | 'system' | 'external' = 'external'): boolean {
    console.log(`🔍 TranscriptionManager.shouldAddTranscript: "${text}" (final: ${isFinal}, speaker: ${speaker})`);
    
    if (!text || text.trim().length < this.MIN_TEXT_LENGTH) {
      console.log(`❌ Text too short: "${text}"`);
      return false;
    }

    const normalizedText = this.normalizeText(text);
    const now = Date.now();

    // For interim results, be more lenient
    if (!isFinal) {
      console.log(`✅ Allowing interim result: "${text}"`);
      // Add interim message but don't track for duplicates
      this.addMessage(text, speaker, false);
      return true;
    }

    // For final results, apply stricter filtering
    // Check if we've seen this exact text before
    if (this.finalTranscripts.has(normalizedText)) {
      console.log(`❌ Duplicate final transcript: "${text}"`);
      return false;
    }

    // Check minimum time between additions for final results only
    if (now - this.lastProcessedTime < this.MIN_TIME_BETWEEN_ADDITIONS) {
      console.log(`❌ Too soon for new transcript (${now - this.lastProcessedTime}ms < ${this.MIN_TIME_BETWEEN_ADDITIONS}ms)`);
      return false;
    }

    // Add to our tracking and update timestamp
    this.finalTranscripts.add(normalizedText);
    this.lastProcessedTime = now;

    // Add to messages
    console.log(`✅ Adding final transcript: "${text}"`);
    this.addMessage(text, speaker, true);

    // Clean up old transcripts to prevent memory issues
    this.cleanupOldTranscripts();

    return true;
  }

  /**
   * Adds a message to the chat history
   */
  addMessage(text: string, speaker: 'user' | 'system' | 'external' = 'external', isFinal: boolean = true): void {
    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      speaker,
      isInterim: !isFinal
    };

    this.messages.push(message);
    console.log(`📝 TranscriptionManager.addMessage: Added "${text}" (speaker: ${speaker}, final: ${isFinal}, total messages: ${this.messages.length})`);

    // Keep only last 100 messages to prevent memory issues
    if (this.messages.length > 100) {
      this.messages = this.messages.slice(-50);
      console.log(`🧹 TranscriptionManager: Trimmed messages to ${this.messages.length}`);
    }
  }

  /**
   * Gets all chat messages
   */
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  /**
   * Detects speaker based on audio characteristics and text content
   */
  detectSpeaker(audioSource: 'microphone' | 'system' | 'mixed', text?: string): 'user' | 'system' | 'external' {
    if (text) {
      return audioSourceDetector.detectSpeaker(text, audioSource);
    }
    
    // Fallback to simple audio source mapping
    switch (audioSource) {
      case 'microphone':
        return 'external'; // External person speaking into mic
      case 'system':
        return 'system';   // System/computer audio
      case 'mixed':
      default:
        return 'external'; // Default to external for mixed sources
    }
  }

  /**
   * Normalizes text for comparison (removes extra whitespace, converts to lowercase)
   */
  private normalizeText(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Removes old transcripts from tracking (keep only last 100 entries)
   */
  private cleanupOldTranscripts(): void {
    if (this.finalTranscripts.size > 100) {
      const transcripts = Array.from(this.finalTranscripts);
      this.finalTranscripts.clear();
      // Keep only the last 50 entries
      transcripts.slice(-50).forEach(transcript => {
        this.finalTranscripts.add(transcript);
      });
    }
  }

  /**
   * Resets the transcription manager state
   */
  reset(): void {
    this.finalTranscripts.clear();
    this.lastProcessedTime = 0;
    this.messages = [];
  }

  /**
   * Formats text with timestamp
   */
  formatWithTimestamp(text: string): string {
    const timestamp = new Date().toLocaleTimeString();
    return ` [${timestamp}] ${text}`;
  }
}

export const transcriptionManager = new TranscriptionManager();
