import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { safePdfParse } from '../../../lib/safePdfParse';

// Use Node.js runtime for PDF processing
export const runtime = 'nodejs';

async function uploadPDFToVectorDB(file: File): Promise<boolean> {
  try {
    if (!process.env.PINECONE_API_KEY || !process.env.GEMINI_API_KEY) {
      console.warn('Pinecone or Gemini API key not configured');
      return false;
    }

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Parse PDF
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await safePdfParse(buffer);

    // Split into chunks
    const chunks = splitIntoChunks(pdfData.text, 1000);
    
    // Generate embeddings and store
    const indexName = process.env.PINECONE_INDEX_NAME || 'interview-docs';
    const index = pinecone.index(indexName);
    const vectors = [];

    console.log('🧮 Generating Gemini embeddings...');
    for (let i = 0; i < chunks.length; i++) {
      // Generate embedding using Gemini
      const model = gemini.getGenerativeModel({ 
        model: 'text-embedding-004'
      });
      
      const result = await model.embedContent(chunks[i]);
      
      if (!result.embedding || !result.embedding.values) {
        throw new Error(`Failed to generate embedding for chunk ${i}`);
      }

      vectors.push({
        id: `${file.name}-chunk-${i}`,
        values: result.embedding.values,
        metadata: {
          content: chunks[i],
          filename: file.name,
          chunkIndex: i,
          title: file.name.replace('.pdf', ''),
          uploadDate: new Date().toISOString(),
          contentType: 'text'
        }
      });
    }

    await index.upsert(vectors);
    return true;
  } catch (error) {
    console.error('Error uploading PDF:', error);
    return false;
  }
}

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const words = text.split(' ');
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  
  return chunks;
}

async function deletePDFFromVectorDB(filename: string): Promise<boolean> {
  try {
    if (!process.env.PINECONE_API_KEY) {
      return false;
    }

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const indexName = process.env.PINECONE_INDEX_NAME || 'interview-docs';
    const index = pinecone.index(indexName);
    
    // Find all chunks for this document
    const searchResponse = await index.query({
      vector: new Array(768).fill(0), // Gemini text-embedding-004 dimensions
      topK: 10000,
      includeMetadata: true,
      filter: { filename: { $eq: filename } }
    });

    if (searchResponse.matches && searchResponse.matches.length > 0) {
      const idsToDelete = searchResponse.matches.map(match => match.id);
      await index.deleteMany(idsToDelete);
    }

    return true;
  } catch (error) {
    console.error('Error deleting document:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    }

    const success = await uploadPDFToVectorDB(file);

    if (success) {
      return NextResponse.json({ 
        message: "PDF uploaded successfully",
        filename: file.name,
        size: file.size
      });
    } else {
      return NextResponse.json({ error: "Failed to upload PDF" }, { status: 500 });
    }
  } catch (error) {
    console.error("PDF upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return NextResponse.json({ error: "No filename provided" }, { status: 400 });
    }

    const success = await deletePDFFromVectorDB(filename);

    if (success) {
      return NextResponse.json({ message: "PDF deleted successfully" });
    } else {
      return NextResponse.json({ error: "Failed to delete PDF" }, { status: 500 });
    }
  } catch (error) {
    console.error("PDF delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
