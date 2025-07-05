import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  console.log("✅ RAG API endpoint working!");
  
  try {
    const { transcript, background } = await request.json();
    
    if (!transcript) {
      return NextResponse.json({ error: "Transcript required" }, { status: 400 });
    }

    // For now, return a simple test response
    return NextResponse.json({
      message: "RAG API working!",
      transcript: transcript,
      extractedQuestion: null,
      context: {
        pdfResults: [],
        webResults: [],
        combinedContext: "",
        citations: []
      },
      searchPerformed: false
    });
  } catch (error) {
    console.error("RAG API error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
