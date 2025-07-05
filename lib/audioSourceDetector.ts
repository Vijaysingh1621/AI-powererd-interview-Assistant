/**
 * Audio source detection utility for determining if speech is from system or external source
 */

export class AudioSourceDetector {
  private systemKeywords = [
    'computer', 'system', 'application', 'software', 'program', 'interface',
    'click', 'button', 'menu', 'window', 'dialog', 'notification',
    'welcome', 'please select', 'choose an option', 'press', 'enter',
    'loading', 'processing', 'saving', 'downloading', 'installing'
  ];

  private interviewKeywords = [
    'tell me about', 'describe', 'explain', 'why did you', 'how would you',
    'what is your experience', 'can you walk me through', 'give me an example',
    'what would you do if', 'how do you handle', 'what are your thoughts',
    'interview', 'question', 'answer', 'experience', 'background', 'skills'
  ];

  /**
   * Analyzes text content to determine likely audio source
   * @param text The transcribed text
   * @param audioSource The detected audio source from recorder
   * @returns Refined speaker classification
   */
  detectSpeaker(text: string, audioSource: 'microphone' | 'system' | 'mixed'): 'user' | 'system' | 'external' {
    const lowerText = text.toLowerCase();
    
    // Count keyword matches
    const systemMatches = this.systemKeywords.filter(keyword => 
      lowerText.includes(keyword)
    ).length;
    
    const interviewMatches = this.interviewKeywords.filter(keyword => 
      lowerText.includes(keyword)
    ).length;

    // If we have strong keyword indicators, use them
    if (systemMatches > 0 && systemMatches > interviewMatches) {
      return 'system';
    }
    
    if (interviewMatches > 0 && interviewMatches > systemMatches) {
      return 'external'; // Interview questions = external person
    }

    // Fallback to audio source detection
    switch (audioSource) {
      case 'microphone':
        return 'external'; // Microphone usually picks up external person
      case 'system':
        return 'system';   // System audio is clearly system
      case 'mixed':
      default:
        // For mixed sources, use simple heuristics
        if (this.isLikelySystemAudio(lowerText)) {
          return 'system';
        }
        return 'external'; // Default to external for mixed
    }
  }

  /**
   * Simple heuristics to detect system audio patterns
   */
  private isLikelySystemAudio(text: string): boolean {
    // System audio often has shorter, more technical phrases
    const words = text.split(' ');
    
    // Very short phrases are often system notifications
    if (words.length <= 3) {
      return true;
    }

    // Check for common system audio patterns
    const systemPatterns = [
      /\b(click|press|enter|select|choose)\b/,
      /\b(loading|processing|please wait)\b/,
      /\b(error|warning|alert|notification)\b/,
      /\b(save|open|close|exit)\b/
    ];

    return systemPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Analyzes audio characteristics (placeholder for future audio analysis)
   */
  analyzeAudioCharacteristics(audioData: any): {
    volume: number;
    frequency: number;
    isLikelyHuman: boolean;
  } {
    // This would analyze actual audio data in a real implementation
    // For now, return default values
    return {
      volume: 0.5,
      frequency: 440,
      isLikelyHuman: true
    };
  }
}

export const audioSourceDetector = new AudioSourceDetector();
