// Test web search agent export
import { webSearchAgent, testWebSearchAgentExport } from './lib/agents/webSearchAgent';

console.log('🧪 Testing webSearchAgent export...');
console.log('webSearchAgent:', typeof webSearchAgent);
console.log('webSearchAgent defined:', webSearchAgent !== undefined);

if (testWebSearchAgentExport) {
  console.log('Test function available:', typeof testWebSearchAgentExport);
  testWebSearchAgentExport();
}

if (webSearchAgent && webSearchAgent.searchWeb) {
  console.log('✅ searchWeb method available');
} else {
  console.log('❌ searchWeb method NOT available');
  console.log('webSearchAgent properties:', Object.getOwnPropertyNames(webSearchAgent || {}));
}
