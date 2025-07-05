# Testing Guide for AI Interview Assistant

## Features to Test

### 1. Basic AI Mode
1. Open the application at http://localhost:3001
2. Enter some text in the transcript box (make it larger now)
3. Toggle "AI Mode" switch
4. Click "Send" button
5. Verify that the AI responds

### 2. PDF Upload and Management
1. In the PDF Management section at the bottom
2. Click "Choose File" and upload a PDF
3. Verify upload success message
4. Try uploading another PDF
5. Test deleting a PDF using the delete button

### 3. RAG Pipeline Testing
1. Upload a PDF with relevant content
2. Enter a transcript that contains a question related to the PDF content
3. Toggle "AI Mode" switch
4. Click "Send"
5. Look for:
   - **Extracted Question** displayed above the AI response
   - **AI Response** that uses context from the PDF and web search
   - **Citations** displayed below the response showing sources

### 4. Question Extraction
Test with these sample transcripts that contain questions:

```
"So I was wondering, what are the best practices for React performance optimization?"

"The interviewer asked me about database normalization. Can you explain the different normal forms?"

"I'm preparing for a technical interview and need to understand how microservices architecture works."
```

### 5. Error Handling
- Try uploading a non-PDF file
- Try sending empty transcript
- Try with AI Mode when no PDFs are uploaded

## Expected Behavior

### When AI Mode is ON:
1. System extracts questions from transcript
2. If question found (confidence > 0.4):
   - Searches uploaded PDFs for relevant context
   - Performs web search for additional context
   - Displays extracted question above response
   - Shows citations below response
3. If no clear question found:
   - Falls back to normal AI response without RAG

### When AI Mode is OFF:
- Normal AI chat functionality without RAG processing

## API Endpoints

- `/api/completion` - Main chat endpoint (Edge runtime)
- `/api/rag` - RAG processing endpoint (Node.js runtime)
- `/api/pdf` - PDF upload/delete endpoint (Node.js runtime)

## Environment Variables Required

Make sure these are set in your `.env` file:
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_ENVIRONMENT`
- `PINECONE_INDEX_NAME`
- `SERPAPI_KEY`
