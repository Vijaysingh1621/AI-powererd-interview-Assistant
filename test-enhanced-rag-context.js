/**
 * Test script for enhanced RAG orchestrator with page numbers and detailed context
 */

// Use dynamic import for ES modules
async function loadRAGOrchestrator() {
  try {
    const { ragOrchestrator } = await import('./lib/agents/ragOrchestrator.js');
    return ragOrchestrator;
  } catch (error) {
    console.error('Failed to load RAG orchestrator:', error.message);
    console.log('This might be due to:');
    console.log('1. Missing dependencies - run: npm install');
    console.log('2. TypeScript not compiled - this is a .ts file that needs compilation');
    console.log('3. Environment variables not set');
    return null;
  }
}

async function testEnhancedRAGContext() {
  console.log('🧪 Testing Enhanced RAG Context with Page Numbers...\n');
  
  const ragOrchestrator = await loadRAGOrchestrator();
  if (!ragOrchestrator) {
    console.log('❌ Cannot run tests without RAG orchestrator');
    return;
  }
  
  try {
    // Test question about technical concepts
    const testTranscript = "Can you explain how machine learning algorithms work and what are the different types?";
    
    console.log('📝 Processing transcript:', testTranscript);
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Process the transcript
    const result = await ragOrchestrator.processTranscript(testTranscript);
    
    if (result.searchPerformed) {
      console.log('✅ Search performed successfully!');
      console.log('\n📊 **Results Summary:**');
      console.log(`- PDF Results: ${result.context.pdfResults.length}`);
      console.log(`- Web Results: ${result.context.webResults.length}`);
      console.log(`- Total Citations: ${result.context.citations.length}`);
      
      // Show detailed context with page information
      if (result.context.citations.length > 0) {
        console.log('\n' + '='.repeat(60));
        console.log('📚 **DETAILED CONTEXT WITH SOURCES:**');
        console.log('='.repeat(60));
        
        // Generate formatted context with references
        const formatted = ragOrchestrator.getFormattedContextWithReferences(result.context);
        
        console.log('\n🔍 **Context Content:**');
        console.log(formatted.formattedContext);
        
        console.log('\n' + formatted.sourceReferences);
        
        // Show detailed citation information
        console.log('\n' + '='.repeat(60));
        console.log('📖 **DETAILED CITATION ANALYSIS:**');
        console.log('='.repeat(60));
        
        result.context.citations.forEach((citation, index) => {
          console.log(`\n**Citation ${index + 1}:**`);
          console.log(`- Type: ${citation.sourceType.toUpperCase()}`);
          console.log(`- Source: ${citation.source}`);
          console.log(`- Relevance Score: ${(citation.score * 100).toFixed(2)}%`);
          
          if (citation.sourceType === 'pdf') {
            if (citation.filename) {
              console.log(`- Filename: ${citation.filename}`);
            }
            if (citation.page) {
              console.log(`- Page: ${citation.page}`);
            }
            if (citation.startPage && citation.endPage) {
              console.log(`- Page Range: ${citation.startPage}-${citation.endPage}`);
            }
            if (citation.pageRange) {
              console.log(`- Formatted Range: ${citation.pageRange}`);
            }
          } else if (citation.sourceType === 'web') {
            if (citation.url) {
              console.log(`- URL: ${citation.url}`);
            }
          }
          
          console.log(`- Context Snippet: "${citation.contextSnippet}"`);
          console.log(`- Full Content Length: ${citation.content.length} characters`);
        });
        
        // Generate context summary
        console.log('\n' + '='.repeat(60));
        console.log('📋 **CONTEXT SUMMARY:**');
        console.log('='.repeat(60));
        
        const summary = ragOrchestrator.generateContextSummary(result.context);
        console.log(summary);
        
      } else {
        console.log('\n⚠️ No citations found - this might indicate:');
        console.log('  - No PDFs uploaded to the system');
        console.log('  - Web search returned no relevant results');
        console.log('  - Search query was too specific or didn\'t match content');
      }
      
    } else {
      console.log('❌ Search was not performed');
      console.log('This could be due to:');
      console.log('- Question extraction failed');
      console.log('- Search query was too short');
      console.log('- API issues');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('\nError details:');
    console.error('- Message:', error.message);
    console.error('- Stack:', error.stack);
  }
}

// Test with a different type of question
async function testPDFSpecificQuestion() {
  console.log('\n\n🧪 Testing PDF-specific question...\n');
  
  const ragOrchestrator = await loadRAGOrchestrator();
  if (!ragOrchestrator) {
    console.log('❌ Cannot run PDF test without RAG orchestrator');
    return;
  }
  
  try {
    const pdfQuestion = "What are the key principles mentioned in the documentation about software architecture?";
    
    console.log('📝 Processing PDF-focused transcript:', pdfQuestion);
    console.log('\n' + '='.repeat(60) + '\n');
    
    const result = await ragOrchestrator.processTranscript(pdfQuestion);
    
    if (result.searchPerformed && result.context.pdfResults.length > 0) {
      console.log('✅ PDF search successful!');
      console.log(`📄 Found ${result.context.pdfResults.length} relevant PDF sections`);
      
      // Show PDF-specific information
      result.context.pdfResults.forEach((pdfResult, index) => {
        console.log(`\n📖 **PDF Result ${index + 1}:**`);
        console.log(`- Source: ${pdfResult.source}`);
        console.log(`- Score: ${(pdfResult.score * 100).toFixed(2)}%`);
        
        if (pdfResult.page) {
          console.log(`- Page: ${pdfResult.page}`);
        }
        if (pdfResult.startPage && pdfResult.endPage) {
          console.log(`- Page Range: ${pdfResult.startPage} to ${pdfResult.endPage}`);
        }
        if (pdfResult.metadata?.filename) {
          console.log(`- Filename: ${pdfResult.metadata.filename}`);
        }
        
        console.log(`- Content Preview: "${pdfResult.content.substring(0, 200)}..."`);
      });
      
    } else {
      console.log('ℹ️ No PDF results found - you may need to upload PDF documents first');
    }
    
  } catch (error) {
    console.error('❌ PDF test failed:', error);
  }
}

// Run the tests
async function runAllTests() {
  console.log('🚀 Starting Enhanced RAG Context Tests...\n');
  
  await testEnhancedRAGContext();
  await testPDFSpecificQuestion();
  
  console.log('\n✅ All tests completed!');
  console.log('\n💡 **How to use the enhanced features:**');
  console.log('1. Use ragOrchestrator.processTranscript(text) to get results');
  console.log('2. Use ragOrchestrator.getFormattedContextWithReferences(context) for numbered references');
  console.log('3. Use ragOrchestrator.generateContextSummary(context) for detailed source info');
  console.log('4. Access citation.pageRange, citation.filename, and citation.contextSnippet for specific details');
}

// Handle different execution contexts
if (require.main === module) {
  runAllTests().catch(console.error);
} else {
  module.exports = { testEnhancedRAGContext, testPDFSpecificQuestion };
}
