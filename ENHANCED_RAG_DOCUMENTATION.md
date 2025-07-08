# Enhanced RAG System with Page Numbers and Context Attribution

## Overview

The enhanced RAG (Retrieval-Augmented Generation) system now provides detailed source attribution including page numbers, context snippets, and comprehensive citation information. This guide explains how to use and understand the enhanced features.

## 🆕 New Features

### 1. Enhanced Citation Interface

- **Page Numbers**: PDF sources now show exact page numbers and page ranges
- **Source Type Identification**: Clear distinction between PDF and web sources
- **Context Snippets**: Preview of relevant content from each source
- **Relevance Scoring**: Percentage score showing how relevant each source is to your query
- **Page Range Information**: For content spanning multiple pages

### 2. Detailed Source Attribution

- **PDF Sources**: Show filename, page number(s), and exact content location
- **Web Sources**: Show website name, URL, and content snippet
- **Visual Indicators**: Color-coded badges for different source types
- **Interactive Elements**: Click to view PDF pages or visit web sources

### 3. Enhanced Context Display

- **Numbered References**: Each source gets a reference number [1], [2], etc.
- **Summary Statistics**: Overview of source counts and average relevance
- **Content Preview**: Longer content previews for better context understanding
- **Source Metadata**: Additional information like document filename and upload date

## 📚 API Interface

### Enhanced Citation Object

```typescript
interface Citation {
  source: string; // Source name/title
  content: string; // Full content text
  url?: string; // URL for web sources
  score: number; // Relevance score (0-1)
  sourceType: "pdf" | "web"; // Source type
  page?: number; // Primary page number
  startPage?: number; // Start page for ranges
  endPage?: number; // End page for ranges
  filename?: string; // PDF filename
  pageRange?: string; // Formatted page info (e.g., "Pages 5-7")
  contextSnippet?: string; // Short preview of content
}
```

### RAG Context Object

```typescript
interface RAGContext {
  pdfResults: SearchResult[]; // Raw PDF search results
  webResults: WebSearchResult[]; // Raw web search results
  combinedContext: string; // Combined context for AI
  citations: Citation[]; // Enhanced citation array
}
```

## 🛠️ Usage Examples

### 1. Basic RAG Processing

```typescript
import { ragOrchestrator } from "@/lib/agents/ragOrchestrator";

const result = await ragOrchestrator.processTranscript(
  "What are the best practices for machine learning model deployment?",
  "Software engineering interview context"
);

console.log("Search performed:", result.searchPerformed);
console.log("Citations found:", result.context.citations.length);
```

### 2. Generate Formatted Context with References

```typescript
const formatted = ragOrchestrator.getFormattedContextWithReferences(
  result.context
);

console.log("Context with numbered references:");
console.log(formatted.formattedContext);

console.log("Source references:");
console.log(formatted.sourceReferences);
```

### 3. Generate Detailed Context Summary

```typescript
const summary = ragOrchestrator.generateContextSummary(result.context);
console.log("Detailed source summary:");
console.log(summary);
```

## 🎨 UI Components

### Enhanced Citation Display

The UI now shows:

- **Source Type Badges**: Visual indicators for PDF vs Web sources
- **Page Number Badges**: Clickable page references for PDFs
- **Relevance Scores**: Percentage indicators for source relevance
- **Action Buttons**: Direct links to view sources or PDF pages
- **Content Previews**: Expanded text previews with better formatting

### Citation Section Features

- **Responsive Layout**: Adapts to different screen sizes
- **Interactive Elements**: Hover effects and click actions
- **Color Coding**: Different colors for different source types
- **Summary Statistics**: Footer with source counts and average relevance

## 📖 Understanding Page Numbers

### How Page Numbers Are Determined

1. **PDF Parsing**: When a PDF is uploaded, it's split into chunks
2. **Page Estimation**: Each chunk is assigned page numbers based on character position
3. **Range Calculation**: If content spans multiple pages, start and end pages are recorded
4. **Display Logic**: The UI shows either single pages or page ranges

### Page Number Accuracy

- Page numbers are estimated based on content position within the PDF
- Actual page breaks may vary depending on PDF structure
- For best accuracy, ensure PDFs have clear page structure

### Page Range Examples

- **Single Page**: "Page 5"
- **Page Range**: "Pages 5-7"
- **Multiple Chunks**: Content may come from different page ranges

## 🔍 Search and Ranking

### Source Prioritization

1. **PDF sources** are prioritized over web sources for accuracy
2. **Relevance scores** determine ranking within each source type
3. **Top 4 results** are selected for context generation
4. **Content length** is optimized for AI processing

### Relevance Scoring

- **0-100%**: Percentage representation of relevance score
- **Higher scores**: More relevant to the original query
- **Combined scoring**: Uses both semantic similarity and content quality

## 🚀 Testing the Enhanced Features

### Run the Test Script

```bash
node test-enhanced-rag-context.js
```

This will demonstrate:

- Enhanced citation display
- Page number attribution
- Context formatting
- Source analysis

### Expected Output

- Detailed source breakdown with page numbers
- Formatted context with numbered references
- Citation analysis with relevance scores
- Source type identification

## 🔧 Configuration

### Environment Variables

```env
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX_NAME=interview-docs
GEMINI_API_KEY=your_gemini_key
TAVILY_API_KEY=your_tavily_key
```

### Chunk Size Configuration

The system uses optimized chunk sizes:

- **150 words** per chunk for better token management
- **Sentence-based splitting** for natural content boundaries
- **Page tracking** throughout the chunking process

## 📊 Performance Optimization

### Citation Processing

- **Parallel searches**: PDF and web searches run simultaneously
- **Error handling**: Graceful fallback when sources are unavailable
- **Content filtering**: Only meaningful content is processed
- **Rate limiting**: Built-in delays to prevent API overload

### UI Performance

- **Lazy loading**: Citations load as needed
- **Efficient rendering**: Optimized React components
- **Responsive design**: Adapts to different screen sizes
- **Interactive feedback**: Loading states and error handling

## 🐛 Troubleshooting

### Common Issues

1. **No Page Numbers Showing**

   - Ensure PDFs are properly uploaded and indexed
   - Check that the PDF parsing was successful
   - Verify the PDF has clear text content

2. **Low Relevance Scores**

   - Try more specific search queries
   - Ensure uploaded PDFs are relevant to your questions
   - Check that the question extraction is working

3. **Missing Citations**

   - Verify API keys are properly configured
   - Check that both PDF and web search are enabled
   - Ensure the transcript contains a clear question

4. **Page Number Inaccuracy**
   - Page numbers are estimated based on content position
   - Complex PDF layouts may affect accuracy
   - Consider the PDF structure when interpreting page numbers

### Debug Information

The system provides detailed console logging:

- Search query generation
- PDF and web search results
- Citation processing steps
- Context combination details

## 🎯 Best Practices

### For Better Page Number Accuracy

1. Upload PDFs with clear text structure
2. Ensure PDFs have consistent formatting
3. Avoid heavily image-based or scanned PDFs
4. Use PDFs with proper page breaks

### For Better Search Results

1. Ask specific, clear questions
2. Provide relevant background context
3. Upload relevant PDF documents
4. Use keywords that match your document content

### For Better Citation Quality

1. Review relevance scores when evaluating sources
2. Check both PDF and web sources for comprehensive answers
3. Use the page numbers to verify source information
4. Consider the context snippet when evaluating relevance

## 📈 Future Enhancements

Planned improvements include:

- **OCR Integration**: Better handling of scanned PDFs
- **Advanced Page Detection**: More accurate page number estimation
- **Citation Clustering**: Grouping related citations from the same source
- **Source Quality Scoring**: Additional metrics for source reliability
- **Export Features**: Export citations in various formats

## 📞 Support

If you encounter issues with the enhanced RAG system:

1. Check the console logs for detailed error information
2. Verify all API keys are properly configured
3. Test with the provided test script
4. Review this documentation for troubleshooting steps
