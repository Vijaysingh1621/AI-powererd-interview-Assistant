import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function buildPrompt(bg: string | undefined, conversation: string) {
  return `You are an expert AI interview assistant helping with technical interview questions. Provide clear, concise, and helpful responses based on your knowledge.

${bg ? `Background Context: ${bg}` : ''}

Recent Interview Conversation:
${conversation}

Provide a helpful response:`;
}

export function buildKnowledgeCheckPrompt(conversation: string) {
  return `You are an AI assistant that needs to determine if you have sufficient knowledge to answer a question.

Conversation: ${conversation}

Analyze this conversation and determine:
1. Is there a clear question being asked?
2. Do you have sufficient knowledge to provide a comprehensive answer?
3. Or would you need external documents/context to give a complete response?

Respond with ONLY one of these formats:
- "KNOWN: [brief answer preview]" - if you can answer comprehensively
- "NEED_CONTEXT: [what specific information you need]" - if you need external sources

Examples:
- For "What is React?" → "KNOWN: React is a JavaScript library..."
- For "What's my GPA?" → "NEED_CONTEXT: Personal academic information"
- For "Company policy on remote work?" → "NEED_CONTEXT: Specific company policies"`;
}

export function buildRAGPrompt(bg: string | undefined, conversation: string, extractedQuestion: string, context: string) {
  return `You are an expert AI interview assistant. Use the provided context along with your knowledge to give the most comprehensive and accurate answer possible.

Context Information:
${context}

${bg ? `Background: ${bg}` : ''}

Question: ${extractedQuestion}

Provide a clear, comprehensive response using both the context and your expertise:`;
}

export function buildSummerizerPrompt(text: string) {
  return `You are a summerizer. You are summarizing the given text. Summarize the following text. Only write summary.
Content:
${text}
Summary:
`;
}
