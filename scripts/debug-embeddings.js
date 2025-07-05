#!/usr/bin/env node

/**
 * Debug script to test and analyze Gemini embedding token usage
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function testEmbeddingLimits() {
  console.log('🔍 Testing Gemini Embedding Token Limits...\n');
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found in .env.local');
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

  // Test different text lengths
  const testCases = [
    { name: 'Short text', length: 50 },
    { name: 'Medium text', length: 200 },
    { name: 'Long text', length: 500 },
    { name: 'Very long text', length: 1000 },
    { name: 'Extremely long text', length: 2000 },
    { name: 'Maximum test', length: 3000 },
  ];

  for (const testCase of testCases) {
    try {
      // Generate test text
      const testText = 'This is a test sentence for embedding analysis. '.repeat(
        Math.ceil(testCase.length / 50)
      ).substring(0, testCase.length);

      const wordCount = testText.split(' ').length;
      const charCount = testText.length;

      console.log(`📝 Testing ${testCase.name}:`);
      console.log(`   Characters: ${charCount}`);
      console.log(`   Words: ${wordCount}`);
      console.log(`   Estimated tokens: ~${Math.ceil(charCount / 4)}`);

      const startTime = Date.now();
      const result = await model.embedContent(testText);
      const endTime = Date.now();

      if (result.embedding && result.embedding.values) {
        console.log(`✅ Success! Embedding dimensions: ${result.embedding.values.length}`);
        console.log(`   Time taken: ${endTime - startTime}ms\n`);
      } else {
        console.log(`❌ Failed - no embedding returned\n`);
      }

    } catch (error) {
      console.log(`❌ Failed with error: ${error.message}`);
      
      if (error.message.includes('token') || error.message.includes('limit')) {
        console.log(`🔍 Token limit reached at ~${testCase.length} characters`);
        console.log(`   This suggests the safe limit is around ${Math.floor(testCase.length * 0.8)} characters\n`);
        break; // Stop testing larger sizes
      } else if (error.message.includes('quota') || error.message.includes('429')) {
        console.log(`⏸️  Rate limit hit, waiting 30 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
        console.log(`   Retrying...`);
        // Don't increment the loop, retry this test case
        continue;
      }
      console.log('');
    }

    // Add delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('🏁 Embedding limit testing completed!');
}

// Test with actual problematic content from PDF
async function testPdfContent() {
  console.log('\n🔍 Testing with PDF-like content...\n');
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

  // Simulate problematic PDF content (lots of whitespace)
  const problematicContent = `
  
  
  
  
  Chapter 1: Introduction
  
  
  This is a sample chapter with lots of whitespace and formatting characters.
  
  
  
  The content may include tables, headers, and other formatting elements.
  
  
  
  1.1 Overview
  
  Content goes here with various formatting issues.
  
  
  
  `;

  // Clean the content
  const cleanedContent = problematicContent
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{3,}/g, ' ')
    .trim();

  console.log('📄 Original content length:', problematicContent.length);
  console.log('🧹 Cleaned content length:', cleanedContent.length);
  console.log('📝 Cleaned content:', cleanedContent.substring(0, 200) + '...\n');

  try {
    const result = await model.embedContent(cleanedContent);
    console.log('✅ Successfully embedded cleaned PDF content!');
    console.log('📊 Embedding dimensions:', result.embedding.values.length);
  } catch (error) {
    console.log('❌ Failed to embed cleaned content:', error.message);
  }
}

// Main execution
async function main() {
  try {
    await testEmbeddingLimits();
    await testPdfContent();
  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

if (require.main === module) {
  main();
}
