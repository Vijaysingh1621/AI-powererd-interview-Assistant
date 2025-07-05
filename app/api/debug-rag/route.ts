import { NextRequest, NextResponse } from 'next/server';
import { ragOrchestrator } from '@/lib/agents/ragOrchestrator';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query') || 'Tell me about Vijay Singh';
    
    console.log('🔍 Debug RAG processing for query:', query);
    
    const ragResult = await ragOrchestrator.processTranscript(query);
    
    return NextResponse.json({
      success: true,
      query,
      extractedQuestion: ragResult.extractedQuestion,
      searchPerformed: ragResult.searchPerformed,
      pdfResultsCount: ragResult.context.pdfResults.length,
      webResultsCount: ragResult.context.webResults.length,
      combinedContextLength: ragResult.context.combinedContext.length,
      combinedContext: ragResult.context.combinedContext,
      citations: ragResult.context.citations,
      pdfResults: ragResult.context.pdfResults.map(r => ({
        content: r.content.substring(0, 200) + '...',
        score: r.score,
        source: r.source,
        page: r.page
      }))
    });
    
  } catch (error) {
    console.error('Error in debug RAG:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
