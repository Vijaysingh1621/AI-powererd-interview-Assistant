import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface ExtractedQuestion {
  question: string;
  context: string;
  confidence: number;
}

export async function extractQuestionFromTranscript(transcript: string): Promise<ExtractedQuestion | null> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
Analyze the following interview transcript and extract the most recent or important question that needs to be answered.

Rules:
1. Focus on questions from the interviewer that require a response
2. Ignore casual conversation or confirmations
3. If multiple questions exist, prioritize the most recent unanswered one
4. Return only ONE primary question
5. Provide confidence score (0-1) based on clarity

Transcript:
"""
${transcript}
"""

Return a JSON response with:
{
  "question": "The extracted question",
  "context": "Brief context around the question",
  "confidence": 0.95
}

If no clear question is found, return:
{
  "question": "",
  "context": "",
  "confidence": 0
}
`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Parse JSON response
    const cleanResponse = response.replace(/```json\n?/, '').replace(/```\n?$/, '').trim();
    const extracted = JSON.parse(cleanResponse);
    
    if (extracted.confidence > 0.3 && extracted.question.trim()) {
      return {
        question: extracted.question,
        context: extracted.context,
        confidence: extracted.confidence
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting question:', error);
    return null;
  }
}
