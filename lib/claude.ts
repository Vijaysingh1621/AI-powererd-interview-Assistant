import Anthropic from '@anthropic-ai/sdk';

// Initialize Claude/Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default anthropic;

export const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';

// Helper function for Claude streaming responses
export async function streamClaude(prompt: string) {
  const stream = await anthropic.messages.create({
    max_tokens: 4000,
    model: CLAUDE_MODEL,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    stream: true,
  });

  return stream;
}
