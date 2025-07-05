# RAG Setup Guide

## 🎯 Overview

Your AI Interview Assistant now includes **Agentic RAG** capabilities with:

- **Question Extraction**: Automatically identifies questions from conversation
- **PDF Search**: Searches uploaded documents for relevant context
- **Web Search**: Finds current information using Tavily API
- **Contextual Responses**: AI responses enriched with retrieved information
- **Citations**: Shows sources and references for transparency

## 🔧 Required API Keys

### 1. Pinecone (Vector Database)

1. Go to [Pinecone Console](https://app.pinecone.io/)
2. Create account and project
3. Create index named `interview-docs`
   - Dimensions: `1536`
   - Metric: `cosine`
4. Get API key from API Keys section
5. Add to `.env`: `PINECONE_API_KEY=your-key`

### 2. OpenAI (Embeddings)

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create API key
3. Add to `.env`: `OPENAI_API_KEY=your-key`

### 3. Tavily API (Web Search)

1. Go to [Tavily](https://tavily.com/)
2. Create account and get API key
3. Add to `.env`: `TAVILY_API_KEY=your-key`

## 📋 Environment Variables

Update your `.env` file:

```env
DEEPGRAM_API_KEY=your-deepgram-key
GEMINI_API_KEY=your-gemini-key

# RAG Configuration
PINECONE_API_KEY=your-pinecone-key
PINECONE_ENVIRONMENT=your-pinecone-environment
PINECONE_INDEX_NAME=interview-docs
TAVILY_API_KEY=your-tavily-key
OPENAI_API_KEY=your-openai-key
```

## 🚀 How It Works

### 1. **Upload PDFs**

- Click "Upload PDF" to add documents (resumes, company docs, etc.)
- Documents are chunked and stored in Pinecone vector database
- AI can now reference your uploaded content

### 2. **Question Extraction**

- AI automatically extracts questions from conversation transcript
- Shows extracted question above the response
- Only processes when confidence > 40%

### 3. **Multi-Agent Search**

- **PDF Agent**: Searches uploaded documents
- **Web Agent**: Searches current web information
- **Contextual Fusion**: Combines and ranks all results

### 4. **Enhanced Responses**

- AI gets both conversation history AND retrieved context
- Responses are more accurate and informed
- Citations show exactly where information came from

## 🎛️ Features

### In the UI:

- **📚 PDF Knowledge Base**: Upload and manage documents
- **🤔 Extracted Question**: Shows what AI identified as the main question
- **🤖 AI Response**: Enhanced response using RAG
- **📚 Sources & Citations**: Shows exactly where information came from

### Smart Features:

- **Automatic question detection** from conversation
- **Parallel search** across PDFs and web
- **Relevance scoring** for better context
- **Source attribution** for transparency
- **Real-time processing** during interviews

## 💡 Best Practices

### For Better Results:

1. **Upload relevant PDFs**: Resume, company docs, technical references
2. **Clear conversation**: Speak clearly for better transcription
3. **Specific questions**: More specific questions get better RAG results
4. **Background info**: Add company/role details in Interview Background

### Example Usage:

1. Upload your resume as PDF
2. Add company info in Interview Background
3. Start conversation with interviewer
4. AI automatically extracts questions
5. Get contextual responses with citations

## 🔍 Troubleshooting

### No RAG Results?

- Check if question was extracted (should show above response)
- Verify API keys are set correctly
- Check console for any errors

### Poor Search Results?

- Upload more relevant PDFs
- Add more context in Interview Background
- Ensure questions are clear and specific

### Citations Not Showing?

- Only shows when RAG finds relevant context
- Check that SERPAPI and Pinecone are configured
- Verify search returned results in console

## 🎯 What's New

Your interview assistant now:

- ✅ **Extracts questions** automatically from conversation
- ✅ **Searches PDFs** for relevant information
- ✅ **Searches web** for current information
- ✅ **Shows citations** for transparency
- ✅ **Provides contextual responses** using retrieved knowledge
- ✅ **Manages PDF uploads** with simple UI

Ready to have smarter, more informed interview responses! 🚀
