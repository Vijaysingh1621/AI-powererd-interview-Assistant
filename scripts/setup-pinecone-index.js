#!/usr/bin/env node

/**
 * Script to create a Pinecone index for the AI Interview Assistant
 * Run this script once to set up your Pinecone vector database
 */

const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config({ path: '.env.local' });

async function createPineconeIndex() {
  try {
    console.log('🔧 Setting up Pinecone index...');
    
    // Check for required environment variables
    if (!process.env.PINECONE_API_KEY) {
      console.error('❌ PINECONE_API_KEY not found in .env.local');
      console.error('   Please add your Pinecone API key to .env.local');
      process.exit(1);
    }

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const indexName = process.env.PINECONE_INDEX_NAME || 'interview-docs';
    console.log(`📊 Creating index: ${indexName}`);

    // Check if index already exists
    try {
      const existingIndexes = await pinecone.listIndexes();
      const indexExists = existingIndexes.indexes?.some(index => index.name === indexName);
      
      if (indexExists) {
        console.log(`✅ Index "${indexName}" already exists!`);
        console.log('🎉 Setup complete - you can now upload PDFs to your application');
        return;
      }
    } catch (error) {
      console.log('📋 Checking existing indexes...');
    }

    // Create the index with correct specifications for Gemini embeddings
    console.log('🏗️ Creating new Pinecone index...');
    await pinecone.createIndex({
      name: indexName,
      dimension: 768, // Google Gemini text-embedding-004 dimensions
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });

    console.log('⏳ Waiting for index to be ready...');
    
    // Wait for index to be ready
    let indexReady = false;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max
    
    while (!indexReady && attempts < maxAttempts) {
      try {
        const indexStats = await pinecone.index(indexName).describeIndexStats();
        console.log(`📊 Index status check ${attempts + 1}/${maxAttempts}...`);
        indexReady = true;
      } catch (error) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      }
    }

    if (indexReady) {
      console.log('✅ Pinecone index created successfully!');
      console.log(`📝 Index details:`);
      console.log(`   Name: ${indexName}`);
      console.log(`   Dimensions: 768 (Gemini embeddings)`);
      console.log(`   Metric: cosine similarity`);
      console.log(`   Cloud: AWS (us-east-1)`);
      console.log('');
      console.log('🎉 Setup complete! You can now:');
      console.log('   1. Start your development server: yarn dev');
      console.log('   2. Upload PDF documents through the web interface');
      console.log('   3. Search and get AI-powered responses with context');
    } else {
      console.error('❌ Index creation timed out. Please check your Pinecone dashboard.');
    }

  } catch (error) {
    console.error('❌ Error setting up Pinecone index:', error.message);
    
    if (error.message.includes('quota')) {
      console.error('💡 This might be a quota issue. Check your Pinecone plan limits.');
    } else if (error.message.includes('auth')) {
      console.error('💡 This might be an authentication issue. Check your PINECONE_API_KEY.');
    }
    
    console.error('📖 For more help, visit: https://docs.pinecone.io/');
    process.exit(1);
  }
}

// Run the setup
createPineconeIndex();
