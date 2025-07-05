import { ragOrchestrator } from './lib/agents/ragOrchestrator.js';

async function testRAGSystem() {
  try {
    console.log('🧪 Testing RAG System...');
    
    const testTranscript = "What are the main benefits of using React hooks in modern web development?";
    const testBackground = "Software Engineering Interview";
    
    console.log('📝 Test transcript:', testTranscript);
    
    const result = await ragOrchestrator.processTranscript(testTranscript, testBackground);
    
    console.log('✅ RAG System Test Results:');
    console.log('- Extracted Question:', result.extractedQuestion?.question || 'None');
    console.log('- Search Performed:', result.searchPerformed);
    console.log('- PDF Results:', result.context.pdfResults.length);
    console.log('- Web Results:', result.context.webResults.length);
    console.log('- Combined Context Length:', result.context.combinedContext.length);
    
    if (result.context.citations.length > 0) {
      console.log('📚 Citations:');
      result.context.citations.forEach((citation, index) => {
        console.log(`  ${index + 1}. ${citation.source} (Score: ${citation.score})`);
      });
    }
    
  } catch (error) {
    console.error('❌ RAG System Test Failed:', error);
    
    // Check for specific ENOENT errors
    if (error.code === 'ENOENT') {
      console.error('🔍 File not found error detected:');
      console.error('   Path:', error.path);
      console.error('   This might be a hardcoded test file reference.');
    }
  }
}

testRAGSystem();
