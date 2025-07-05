# 🔧 Troubleshooting Guide

## Common Setup Issues

### 1. Pinecone Index Not Found (HTTP 404)

**Error:** `PineconeNotFoundError: A call to https://api.pinecone.io/indexes/interview-docs returned HTTP status 404`

**Solution:**
```bash
# Run the Pinecone setup script
yarn setup-pinecone
```

This error occurs when the Pinecone index doesn't exist. The setup script will create the required index with the correct specifications for Gemini embeddings.

### 2. PDF Processing Warnings

**Warning:** `Invalid stream: "FormatError: Unknown compression method in flate stream"`

**Explanation:** This is a common warning when processing certain PDF files with complex compression. The application will still attempt to extract text content.

**Solutions:**
- Try a different PDF file to test the system
- Ensure the PDF contains extractable text (not just images)
- Convert scanned PDFs using OCR before uploading

### 3. Environment Variables

**Make sure your `.env.local` file contains all required variables:**

```bash
# Required for basic functionality
DEEPGRAM_API_KEY="your-deepgram-api-key"
GEMINI_API_KEY="your-gemini-api-key"

# Required for RAG features
PINECONE_API_KEY="your-pinecone-api-key"
PINECONE_ENVIRONMENT="us-east1-gcp"
PINECONE_INDEX_NAME="interview-docs"
TAVILY_API_KEY="your-tavily-api-key"
```

### 4. API Key Issues

**Gemini API Key:**
- Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- Ensure billing is enabled for your Google Cloud project

**Pinecone API Key:**
- Get your API key from [Pinecone Console](https://app.pinecone.io/)
- Check your plan limits (free tier has limitations)

**Deepgram API Key:**
- Get your API key from [Deepgram Console](https://console.deepgram.com/)

**Tavily API Key:**
- Get your API key from [Tavily Console](https://app.tavily.com/)

### 5. Development Server Issues

**If the development server fails to start:**

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
yarn install

# Start development server
yarn dev
```

### 6. Pinecone Index Configuration

**Correct specifications for this application:**
- **Dimensions:** 768 (Google Gemini text-embedding-004)
- **Metric:** cosine
- **Cloud:** AWS
- **Region:** us-east-1

### 7. Memory Issues with Large PDFs

**If you encounter memory issues with large PDF files:**
- Ensure files are under 10MB
- Check available system memory
- Consider splitting large documents

## Getting Help

1. **Check the logs** in your browser developer console and terminal
2. **Verify all environment variables** are correctly set
3. **Test with a simple PDF** (like a text-only document)
4. **Check API quotas** in your respective service dashboards

## Quick Test Commands

```bash
# Test Pinecone connection
yarn setup-pinecone

# Start development server with verbose logging
yarn dev

# Check if all dependencies are installed
yarn install --check-files
```
