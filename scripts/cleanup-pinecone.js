#!/usr/bin/env node

/**
 * Script to clean and re-index existing PDFs with improved chunking
 */

const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config({ path: '.env.local' });

async function cleanupPineconeIndex() {
  console.log('🧹 Starting Pinecone Index Cleanup...\n');
  
  if (!process.env.PINECONE_API_KEY) {
    console.error('❌ PINECONE_API_KEY not found in .env.local');
    process.exit(1);
  }

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  const indexName = process.env.PINECONE_INDEX_NAME || 'interview-docs';
  
  try {
    const index = pinecone.index(indexName);
    
    // Get index statistics
    console.log('📊 Fetching index statistics...');
    const stats = await index.describeIndexStats();
    console.log('Index stats:', stats);
    
    // Query all vectors to see what we have
    console.log('\n🔍 Querying existing vectors...');
    const queryResponse = await index.query({
      vector: new Array(768).fill(0), // Dummy query vector
      topK: 10000, // Increased to get more results
      includeMetadata: true,
    });
    
    console.log(`Found ${queryResponse.matches?.length || 0} vectors`);
    
    if (queryResponse.matches && queryResponse.matches.length > 0) {
      console.log('\n📄 Analyzing existing chunks:');
      
      const problematicChunks = [];
      const goodChunks = [];
      
      queryResponse.matches.forEach((match, index) => {
        const content = match.metadata?.content || '';
        const filename = match.metadata?.filename || 'Unknown';
        const isProblematic = content.length < 50 || content.replace(/\s/g, '').length < 20;
        
        if (isProblematic) {
          problematicChunks.push(match);
        } else {
          goodChunks.push(match);
        }
        
        if (index < 5) { // Show first 5 for debugging
          console.log(`   ${index + 1}. ${filename} (${content.length} chars)`);
          console.log(`      Content preview: "${content.substring(0, 100).replace(/\n/g, '\\n')}..."`);
          console.log(`      Problematic: ${isProblematic ? 'YES' : 'NO'}\n`);
        }
      });
      
      console.log(`📊 Analysis results:`);
      console.log(`   Good chunks: ${goodChunks.length}`);
      console.log(`   Problematic chunks: ${problematicChunks.length}`);
      console.log(`   Total chunks: ${queryResponse.matches.length}`);
      
      if (problematicChunks.length > 0) {
        console.log('\n🗑️  Found problematic chunks that need cleanup');
        console.log('   These are likely chunks with mostly whitespace or very short content');
        
        const shouldDelete = process.argv.includes('--delete-problematic');
        
        if (shouldDelete) {
          console.log('🗑️  Deleting problematic chunks...');
          const idsToDelete = problematicChunks.map(chunk => chunk.id);
          
          // Delete in batches to avoid API limits
          const batchSize = 100;
          for (let i = 0; i < idsToDelete.length; i += batchSize) {
            const batch = idsToDelete.slice(i, i + batchSize);
            console.log(`   Deleting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(idsToDelete.length/batchSize)} (${batch.length} items)`);
            await index.deleteMany(batch);
            
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          console.log('✅ Problematic chunks deleted');
        } else {
          console.log('ℹ️  To delete problematic chunks, run: node scripts/cleanup-pinecone.js --delete-problematic');
        }
      }
      
      // Show unique filenames
      const filenames = [...new Set(queryResponse.matches.map(m => m.metadata?.filename).filter(Boolean))];
      console.log(`\n📁 Files in index: ${filenames.length}`);
      filenames.forEach((filename, index) => {
        console.log(`   ${index + 1}. ${filename}`);
      });
      
    } else {
      console.log('📭 No vectors found in the index');
    }
    
  } catch (error) {
    console.error('❌ Error accessing Pinecone:', error);
    
    if (error.message.includes('404') || error.message.includes('NotFound')) {
      console.error('\n🔍 Index not found. You may need to create it first:');
      console.error('   yarn setup-pinecone');
    } else if (error.message.includes('401') || error.message.includes('authentication')) {
      console.error('\n🔑 Authentication error. Check your PINECONE_API_KEY in .env.local');
    }
  }
}

async function deleteAllVectors() {
  console.log('🗑️  Starting complete index cleanup...\n');
  
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  const indexName = process.env.PINECONE_INDEX_NAME || 'interview-docs';
  const index = pinecone.index(indexName);
  
  try {
    console.log('🗑️  Deleting all vectors from index...');
    await index.deleteAll();
    console.log('✅ All vectors deleted successfully');
    console.log('ℹ️  You can now re-upload your PDFs with the improved chunking');
  } catch (error) {
    console.error('❌ Error deleting vectors:', error);
  }
}

// Main execution
async function main() {
  const shouldDeleteAll = process.argv.includes('--delete-all');
  
  if (shouldDeleteAll) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('⚠️  Are you sure you want to delete ALL vectors? This cannot be undone. (yes/no): ', (answer) => {
      if (answer.toLowerCase() === 'yes') {
        deleteAllVectors().then(() => rl.close());
      } else {
        console.log('❌ Operation cancelled');
        rl.close();
      }
    });
  } else {
    await cleanupPineconeIndex();
  }
}

if (require.main === module) {
  main().catch(console.error);
}
