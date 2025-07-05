#!/usr/bin/env node

/**
 * End-to-end test script for PDF RAG pipeline
 */

require('dotenv').config({ path: '.env.local' });

async function testRAGPipeline() {
  console.log('🔍 Testing End-to-End RAG Pipeline...\n');
  
  // Test cases with different types of questions
  const testCases = [
    {
      name: 'Autonomous Robots Question',
      transcript: 'Tell me about autonomous robots and their control architectures',
      expectedPdfMatch: 'autonomous'
    },
    {
      name: 'Power Electronics Question', 
      transcript: 'What are inverters in power electronics?',
      expectedPdfMatch: 'power'
    },
    {
      name: 'Digital Signal Processing Question',
      transcript: 'Explain digital signal processing concepts',
      expectedPdfMatch: 'signal'
    },
    {
      name: 'Resume Question',
      transcript: 'Tell me about Vijay Singh and his background',
      expectedPdfMatch: 'vijay'
    }
  ];

  for (const testCase of testCases) {
    console.log(`📋 Testing: ${testCase.name}`);
    console.log(`   Query: "${testCase.transcript}"`);
    
    try {
      // Test the RAG orchestrator directly
      const { ragOrchestrator } = await import('../lib/agents/ragOrchestrator.js');
      
      console.log('   🔍 Processing with RAG orchestrator...');
      const ragResult = await ragOrchestrator.processTranscript(testCase.transcript);
      
      console.log(`   📊 Results:`);
      console.log(`      Search performed: ${ragResult.searchPerformed}`);
      console.log(`      PDF results: ${ragResult.context.pdfResults.length}`);
      console.log(`      Web results: ${ragResult.context.webResults.length}`);
      console.log(`      Citations: ${ragResult.context.citations.length}`);
      
      if (ragResult.extractedQuestion) {
        console.log(`      Extracted question: "${ragResult.extractedQuestion.question}"`);
        console.log(`      Confidence: ${ragResult.extractedQuestion.confidence}`);
      }
      
      // Check if we got relevant PDF results
      const pdfContentRelevant = ragResult.context.pdfResults.some(result => 
        result.content.toLowerCase().includes(testCase.expectedPdfMatch) ||
        result.source.toLowerCase().includes(testCase.expectedPdfMatch)
      );
      
      if (ragResult.context.pdfResults.length > 0) {
        console.log(`   📄 PDF Results Preview:`);
        ragResult.context.pdfResults.slice(0, 2).forEach((result, index) => {
          console.log(`      ${index + 1}. ${result.source}`);
          console.log(`         Score: ${result.score.toFixed(3)}`);
          console.log(`         Content: "${result.content.substring(0, 100)}..."`);
        });
      }
      
      if (pdfContentRelevant) {
        console.log(`   ✅ SUCCESS: Found relevant PDF content`);
      } else {
        console.log(`   ⚠️  WARNING: PDF content may not be relevant to query`);
      }
      
      // Test the completion API
      console.log('   🚀 Testing completion API...');
      const response = await fetch('http://localhost:3000/api/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: testCase.transcript,
          bg: 'Test background context',
          flag: 'copilot' // This triggers RAG processing
        }),
      });
      
      if (response.ok) {
        console.log(`   ✅ Completion API responded successfully`);
        // Don't read the full response as it's a stream, just check status
      } else {
        console.log(`   ❌ Completion API failed: ${response.status}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Test failed:`, error.message);
      if (error.stack) {
        console.error(`      Stack: ${error.stack.split('\n')[1]}`);
      }
    }
    
    console.log(''); // Empty line between tests
    
    // Add delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('🏁 RAG Pipeline Testing Complete!');
}

// Test direct PDF search as well
async function testDirectPDFSearch() {
  console.log('\n🔍 Testing Direct PDF Search...\n');
  
  const queries = [
    'autonomous robots',
    'power electronics inverters',
    'digital signal processing',
    'Vijay Singh resume'
  ];
  
  for (const query of queries) {
    try {
      console.log(`📋 Testing query: "${query}"`);
      
      const response = await fetch(`http://localhost:3000/api/test-pdf-search?query=${encodeURIComponent(query)}`);
      const result = await response.json();
      
      if (result.success) {
        console.log(`   ✅ Found ${result.resultsCount} results`);
        if (result.results.length > 0) {
          console.log(`   📄 Top result: ${result.results[0].source}`);
          console.log(`      Score: ${result.results[0].score.toFixed(3)}`);
          console.log(`      Content: "${result.results[0].content.substring(0, 100)}..."`);
        }
      } else {
        console.log(`   ❌ Search failed: ${result.error}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error:`, error.message);
    }
    
    console.log('');
  }
}

// Main execution
async function main() {
  try {
    await testDirectPDFSearch();
    await testRAGPipeline();
  } catch (error) {
    console.error('❌ Test script failed:', error);
  }
}

if (require.main === module) {
  main();
}
