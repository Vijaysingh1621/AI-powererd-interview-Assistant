import { NextRequest, NextResponse } from "next/server";
import { webSearchAgent } from "@/lib/agents/simpleWebSearchAgent";

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    
    console.log('🧪 Testing web search with query:', query);
    
    const result = await webSearchAgent.searchWeb(query, 3);
    
    return NextResponse.json({
      success: true,
      result: result,
      debug: {
        resultsCount: result.results.length,
        searchQuery: result.searchQuery,
        totalResults: result.totalResults
      }
    });
    
  } catch (error) {
    console.error('❌ Web search test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        error: error
      }
    }, { status: 500 });
  }
}
