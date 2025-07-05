/**
 * Local fallback question extractor when Gemini API is unavailable
 */

export interface LocalExtractedQuestion {
  question: string;
  context: string;
  confidence: number;
}

export function extractQuestionLocally(transcript: string): LocalExtractedQuestion | null {
  const text = transcript.toLowerCase().trim();
  
  // Enhanced question patterns
  const questionPatterns = [
    // Direct questions
    { pattern: /(?:interviewer|they|he|she)\s+(?:asked|asks|asking)\s+(?:me\s+)?(?:about\s+)?([^.?!]+(?:\?|\.|\!)?)/i, confidence: 0.9 },
    { pattern: /(?:the\s+)?question\s+(?:was|is)\s+(?:about\s+)?([^.?!]+(?:\?|\.|\!)?)/i, confidence: 0.8 },
    { pattern: /(?:they|he|she)\s+wanted\s+to\s+know\s+(?:about\s+)?([^.?!]+(?:\?|\.|\!)?)/i, confidence: 0.8 },
    
    // Indirect questions
    { pattern: /(?:asked|asking)\s+(?:me\s+)?(?:to\s+)?(?:explain|describe|tell|discuss)\s+([^.?!]+)/i, confidence: 0.7 },
    { pattern: /(?:can\s+you|could\s+you|would\s+you)\s+(?:explain|tell|describe|help)\s+(?:me\s+)?(?:with\s+)?([^.?!]+)/i, confidence: 0.7 },
    
    // Question words
    { pattern: /(?:what|how|why|when|where|which|who)\s+(?:is|are|do|does|did|was|were|will|would|could|should)\s+([^.?!]+)/i, confidence: 0.6 },
    { pattern: /(?:what|how|why|when|where|which|who)\s+([^.?!]+)/i, confidence: 0.5 },
    
    // General inquiry patterns
    { pattern: /(?:tell\s+me|explain|describe)\s+(?:about\s+)?([^.?!]+)/i, confidence: 0.5 },
    { pattern: /(?:I\s+need\s+to\s+know|I\s+want\s+to\s+know|I\s+should\s+know)\s+(?:about\s+)?([^.?!]+)/i, confidence: 0.6 }
  ];

  let bestMatch: LocalExtractedQuestion | null = null;

  for (const { pattern, confidence } of questionPatterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      const questionText = match[1].trim();
      
      // Skip very short or meaningless matches
      if (questionText.length < 5 || /^(it|that|this|yes|no|ok|okay)$/i.test(questionText)) {
        continue;
      }

      // Clean up the question text
      const cleanQuestion = questionText
        .replace(/\s+/g, ' ')
        .replace(/[,;]+$/, '')
        .trim();

      const result: LocalExtractedQuestion = {
        question: cleanQuestion.charAt(0).toUpperCase() + cleanQuestion.slice(1),
        context: transcript.substring(Math.max(0, match.index! - 50), match.index! + match[0].length + 50),
        confidence: confidence
      };

      // Take the highest confidence match
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = result;
      }
    }
  }

  return bestMatch;
}

/**
 * Generate a search query from transcript when no clear question is found
 */
export function generateSearchQuery(transcript: string): string {
  // Remove common filler words and extract key terms
  const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'would', 'could', 'should', 'ought', 'might', 'must'];

  const words = transcript
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !stopWords.includes(word))
    .filter(word => !/^\d+$/.test(word)); // Remove pure numbers

  // Take the 5 most relevant words
  const uniqueWords = Array.from(new Set(words));
  return uniqueWords.slice(0, 5).join(' ');
}
