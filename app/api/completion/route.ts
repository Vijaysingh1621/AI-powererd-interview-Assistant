import genAI from "@/lib/gemini";
import anthropic, { CLAUDE_MODEL } from "@/lib/claude";
import { FLAGS } from "@/lib/types";
import { buildPrompt, buildSummerizerPrompt, buildRAGPrompt } from "@/lib/utils";

export const runtime = "nodejs";
const MODEL = process.env.MODEL || "gemini-1.5-flash";

export async function POST(req: Request) {
  const { bg, flag, prompt: transcribe } = await req.json();

  let prompt = transcribe;
  let ragContext = null;
  let extractedQuestion = null;

  if (flag === FLAGS.COPILOT) {
    // Process with RAG for AI Mode
    try {
      console.log('🤖 Processing with RAG...');
      
      // For now, bypass RAG API and use direct import
      try {
        const { ragOrchestrator } = await import('@/lib/agents/ragOrchestrator');
        const ragData = await ragOrchestrator.processTranscript(transcribe, bg);
        
        extractedQuestion = ragData.extractedQuestion;
        ragContext = ragData.context;
        
        console.log('📊 RAG Processing Results:');
        console.log(`   Search performed: ${ragData.searchPerformed}`);
        console.log(`   PDF results: ${ragContext.pdfResults.length}`);
        console.log(`   Web results: ${ragContext.webResults.length}`);
        console.log(`   Combined context length: ${ragContext.combinedContext.length}`);
        console.log(`   Citations: ${ragContext.citations.length}`);
        if (extractedQuestion) {
          console.log(`   Extracted question: "${extractedQuestion.question}"`);
        }
        
        if (ragData.searchPerformed && extractedQuestion) {
          console.log('🔍 Building RAG prompt with context...');
          prompt = buildRAGPrompt(bg, transcribe, extractedQuestion.question, ragContext.combinedContext);
        } else {
          console.log('⚠️ Using fallback prompt (no question extracted or search failed)');
          prompt = buildPrompt(bg, transcribe);
        }
      } catch (ragError) {
        console.error('RAG processing error:', ragError);
        prompt = buildPrompt(bg, transcribe);
      }
    } catch (error) {
      console.error('RAG processing error:', error);
      prompt = buildPrompt(bg, transcribe);
    }
  } else if (flag === FLAGS.SUMMERIZER) {
    prompt = buildSummerizerPrompt(transcribe);
  }

  // Use Claude-3-Sonnet for reasoning/response generation with error handling
  let claudeStream;
  try {
    claudeStream = await anthropic.messages.create({
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
  } catch (error) {
    console.error('Claude API error:', error);
    
    // Return error response with extracted question and citations if available
    const errorResponse = {
      error: 'Claude API is currently overloaded. Please try again in a moment.',
      extractedQuestion: extractedQuestion?.question || null,
      citations: ragContext?.citations || []
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 503,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const encoder = new TextEncoder();
  const responseStream = new ReadableStream({
    async start(controller) {
      try {
        // If we have an extracted question, send it first
        if (extractedQuestion) {
          const questionData = JSON.stringify({
            type: 'question',
            question: extractedQuestion.question,
            confidence: extractedQuestion.confidence
          }) + '\n';
          controller.enqueue(encoder.encode(questionData));
        }

        // Send the main response
        let responseText = '';
        let hasContent = false;
        
        for await (const chunk of claudeStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const chunkText = chunk.delta.text;
            responseText += chunkText;
            hasContent = true;
            controller.enqueue(encoder.encode(chunkText));
          }
        }

        // If no content was received, send an error message
        if (!hasContent) {
          const errorMessage = 'No response received from Claude API. Please try again.';
          controller.enqueue(encoder.encode(errorMessage));
        }

        // Send citations if available (with separator)
        if (ragContext && ragContext.citations.length > 0) {
          const citationsData = JSON.stringify({
            type: 'citations',
            citations: ragContext.citations
          }) + '\n';
          controller.enqueue(encoder.encode('\n---CITATIONS---\n' + citationsData));
        }

        controller.close();
      } catch (error) {
        console.error('Streaming error:', error);
        
        // Send error message to client
        const errorMessage = `Error: ${error instanceof Error ? error.message : 'Unknown streaming error'}`;
        try {
          controller.enqueue(encoder.encode(errorMessage));
          
          // Still try to send citations if available
          if (ragContext && ragContext.citations.length > 0) {
            const citationsData = JSON.stringify({
              type: 'citations',
              citations: ragContext.citations
            }) + '\n';
            controller.enqueue(encoder.encode('\n---CITATIONS---\n' + citationsData));
          }
          
          controller.close();
        } catch (controllerError) {
          console.error('Controller error:', controllerError);
          controller.error(error);
        }
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
