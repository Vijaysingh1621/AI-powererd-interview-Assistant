import Groq from 'groq-sdk';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export default groq;

// Available Groq models - using currently supported models
export const GROQ_MODEL = 'llama-3.1-8b-instant'; // High-quality model for complex reasoning
export const GROQ_MODEL_FAST = 'llama-3.1-8b-instant'; // Ultra-fast for quick responses
export const GROQ_MODEL_BALANCED = 'llama3-8b-8192'; // Balanced speed and quality

// Helper function for Groq streaming responses
export async function streamGroq(prompt: string, model: string = GROQ_MODEL) {
  const stream = await groq.chat.completions.create({
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    model: model,
    temperature: 0.7,
    max_tokens: 4000,
    stream: true,
  });

  return stream;
}

// Helper function for non-streaming responses
export async function queryGroq(prompt: string, model: string = GROQ_MODEL) {
  const response = await groq.chat.completions.create({
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    model: model,
    temperature: 0.7,
    max_tokens: 4000,
  });

  return response;
}
