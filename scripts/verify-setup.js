#!/usr/bin/env node

/**
 * Script to verify the setup configuration for the AI Interview Assistant
 * Checks all required environment variables and API connections
 */

require('dotenv').config({ path: '.env.local' });

async function verifySetup() {
  console.log('🔍 Verifying AI Interview Assistant Setup...\n');
  
  let allGood = true;
  
  // Check required environment variables
  const requiredVars = [
    'DEEPGRAM_API_KEY',
    'GEMINI_API_KEY', 
    'PINECONE_API_KEY',
    'TAVILY_API_KEY'
  ];
  
  console.log('📋 Environment Variables:');
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value && value !== `your-${varName.toLowerCase().replace('_', '-')}-here`) {
      console.log(`✅ ${varName}: Configured`);
    } else {
      console.log(`❌ ${varName}: Missing or not configured`);
      allGood = false;
    }
  });
  
  // Check optional environment variables
  console.log('\n📋 Optional Configuration:');
  const optionalVars = ['PINECONE_ENVIRONMENT', 'PINECONE_INDEX_NAME', 'MODEL'];
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value}`);
    } else {
      console.log(`⚠️ ${varName}: Using default`);
    }
  });
  
  if (!allGood) {
    console.log('\n❌ Setup incomplete. Please configure missing environment variables in .env.local');
    console.log('📖 See README.md for instructions on getting API keys.');
    return;
  }
  
  console.log('\n🧪 Testing API Connections...');
  
  // Test Pinecone connection
  try {
    const { Pinecone } = require('@pinecone-database/pinecone');
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const indexes = await pinecone.listIndexes();
    const indexName = process.env.PINECONE_INDEX_NAME || 'interview-docs';
    const hasIndex = indexes.indexes?.some(index => index.name === indexName);
    
    if (hasIndex) {
      console.log(`✅ Pinecone: Index "${indexName}" found`);
    } else {
      console.log(`⚠️ Pinecone: Index "${indexName}" not found`);
      console.log('   Run: yarn setup-pinecone');
      allGood = false;
    }
  } catch (error) {
    console.log(`❌ Pinecone: Connection failed - ${error.message}`);
    allGood = false;
  }
  
  // Test Gemini connection
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = gemini.getGenerativeModel({ model: 'text-embedding-004' });
    // Just check if we can create the model (doesn't make an API call)
    console.log('✅ Gemini: API key configured');
  } catch (error) {
    console.log(`❌ Gemini: Configuration failed - ${error.message}`);
    allGood = false;
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allGood) {
    console.log('🎉 Setup verification complete! Your application is ready to use.');
    console.log('\n🚀 Next steps:');
    console.log('   1. Start the development server: yarn dev');
    console.log('   2. Open http://localhost:3000 in your browser');
    console.log('   3. Upload a PDF and test the RAG functionality');
  } else {
    console.log('❌ Setup verification failed. Please fix the issues above.');
    console.log('\n📖 For help, see:');
    console.log('   - README.md for setup instructions');
    console.log('   - TROUBLESHOOTING.md for common issues');
  }
}

// Run the verification
verifySetup().catch(error => {
  console.error('❌ Verification script failed:', error.message);
  process.exit(1);
});
