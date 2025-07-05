import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function buildPrompt(bg: string | undefined, conversation: string) {
  return `You are a interview co-pilot. You are assisting in writing responses to the interviewee's answers. You have access to the interview conversation and the background information for the interview. Write a direct response to the interviewee's question, without including any information about yourself. Create Short Response and donot create background and conversation.
--------------------------------
BACKGROUND: ${bg}
--------------------------------
CONVERSATION: ${conversation}
--------------------------------
Response:`;
}

export function buildRAGPrompt(bg: string | undefined, conversation: string, extractedQuestion: string, context: string) {
  return `IMPORTANT: You must answer using ONLY the exact facts from the document below. Do NOT make up information.

DOCUMENT FACTS:
${context}

QUESTION: ${extractedQuestion}

Based on the document facts above:
- If the document mentions "Netaji Subhas University of Technology (2022-2026)", use exactly that university and those dates
- If the document mentions "Bachelor of Technology in Instrumentation and Control Engineering", use exactly that degree
- If the document shows someone is currently a student (2022-2026), do NOT say they have years of work experience
- Quote the document facts directly, do not invent new information

Answer using only the document facts:`;
}

export function buildSummerizerPrompt(text: string) {
  return `You are a summerizer. You are summarizing the given text. Summarize the following text. Only write summary.
Content:
${text}
Summary:
`;
}
