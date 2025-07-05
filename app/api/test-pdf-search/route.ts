import { NextRequest, NextResponse } from 'next/server';
import { pineconeService } from '@/lib/agents/pineconeService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query') || 'test';
    
    console.log('🔍 Testing PDF search with query:', query);
    
    const results = await pineconeService.searchSimilarContent(query, 3);
    
    return NextResponse.json({
      success: true,
      query,
      resultsCount: results.length,
      results: results.map(r => ({
        content: r.content.substring(0, 200) + '...',
        score: r.score,
        source: r.source,
        page: r.page,
        filename: r.metadata?.filename
      }))
    });
    
  } catch (error) {
    console.error('Error testing PDF search:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
