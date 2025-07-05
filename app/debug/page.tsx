"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { testDeepgramConnection } from '@/lib/deepgramTest';
import { AudioTranscriptDiagnostic } from '@/lib/diagnosticTool';
import dynamic from 'next/dynamic';

// Dynamically import WASAPIRecorder to avoid SSR issues
const WASAPIRecorder = dynamic(() => import("@/components/WASAPIRecorder"), {
  ssr: false,
  loading: () => <div className="text-sm text-gray-500">Loading WASAPI recorder...</div>
});

export default function DebugPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<any>({});
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [isDiagnosticRunning, setIsDiagnosticRunning] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const runEnvironmentTest = async () => {
    setIsTestRunning(true);
    setTestResults({});
    setLogs([]);
    
    addLog('🧪 Starting Environment Test');
    
    const results: any = {};
    
    // Test browser environment
    try {
      results.browserEnv = typeof window !== 'undefined';
      addLog(`✅ Browser environment: ${results.browserEnv}`);
    } catch (e) {
      results.browserEnv = false;
      addLog(`❌ Browser environment test failed: ${e}`);
    }
    
    // Test MediaDevices API
    try {
      results.mediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      addLog(`✅ MediaDevices API: ${results.mediaDevices}`);
    } catch (e) {
      results.mediaDevices = false;
      addLog(`❌ MediaDevices API test failed: ${e}`);
    }
    
    // Test environment variables
    try {
      const deepgramKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      results.envVars = !!deepgramKey;
      addLog(`✅ Environment variables: ${results.envVars ? 'Found' : 'Missing'}`);
      if (deepgramKey) {
        addLog(`   Deepgram key: ${deepgramKey.substring(0, 8)}...`);
      }
    } catch (e) {
      results.envVars = false;
      addLog(`❌ Environment variables test failed: ${e}`);
    }
    
    // Test microphone permissions
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
          channelCount: 1
        } 
      });
      results.micPermission = true;
      addLog('✅ Microphone permission granted');
      stream.getTracks().forEach(track => track.stop());
    } catch (e) {
      results.micPermission = false;
      addLog(`❌ Microphone permission failed: ${e}`);
    }
    
    // Test WebSocket connection to Deepgram
    try {
      const deepgramKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      if (deepgramKey) {
        const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=en&punctuate=true&interim_results=true&endpointing=300&smart_format=true`;
        const ws = new WebSocket(wsUrl, ['token', deepgramKey]);
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Connection timeout'));
          }, 5000);
          
          ws.onopen = () => {
            clearTimeout(timeout);
            results.deepgramConnection = true;
            addLog('✅ Deepgram WebSocket connection successful');
            ws.close();
            resolve(true);
          };
          
          ws.onerror = (error) => {
            clearTimeout(timeout);
            results.deepgramConnection = false;
            addLog(`❌ Deepgram WebSocket connection failed: ${error}`);
            reject(error);
          };
        });
      } else {
        throw new Error('No Deepgram API key found');
      }
    } catch (e) {
      results.deepgramConnection = false;
      addLog(`❌ Deepgram connection test failed: ${e}`);
    }
    
    setTestResults(results);
    setIsTestRunning(false);
    addLog('🎉 Environment test completed');
  };

  const clearLogs = () => {
    setLogs([]);
    setTestResults({});
  };

  const addTextinTranscription = (text: string, speaker?: 'user' | 'system' | 'external') => {
    const timestamp = new Date().toLocaleTimeString();
    addLog(`📝 Transcription [${speaker || 'unknown'}]: ${text}`);
  };
  
  const runComprehensiveDiagnostic = async () => {
    addLog('🔍 Starting comprehensive WASAPI + Deepgram diagnostic...');
    setIsDiagnosticRunning(true);
    setDiagnosticResults(null);
    
    try {
      const diagnostic = new AudioTranscriptDiagnostic();
      const results = await diagnostic.runFullDiagnostic();
      
      // Add diagnostic logs to our logs
      diagnostic.getLogs().forEach(log => addLog(log));
      
      setDiagnosticResults(results);
      addLog('✅ Comprehensive diagnostic completed');
      
    } catch (error) {
      addLog(`❌ Diagnostic failed: ${error}`);
    } finally {
      setIsDiagnosticRunning(false);
    }
  };

  const testDeepgramDirectly = async () => {
    addLog('🧪 Testing Deepgram connection directly...');
    setIsTestRunning(true);
    
    try {
      const result = await testDeepgramConnection();
      addLog(`✅ Deepgram test completed: ${JSON.stringify(result)}`);
    } catch (error) {
      addLog(`❌ Deepgram test failed: ${error}`);
    } finally {
      setIsTestRunning(false);
    }
  };
  
  const testDirectTranscription = () => {
    addLog('🧪 Testing direct transcription callback...');
    
    // Simulate a transcription result
    const mockMessage = {
      id: 'test-' + Date.now(),
      text: 'This is a test transcription',
      timestamp: new Date().toISOString(),
      speaker: 'user' as const,
      isInterim: false
    };
    
    addLog(`📝 Mock transcription: ${mockMessage.text}`);
    addTextinTranscription(mockMessage.text, mockMessage.speaker);
  };

  const onTranscriptionUpdate = (message: any) => {
    addLog(`🔄 Transcription update: ${JSON.stringify(message)}`);
  };

  const onStatusChange = (isActive: boolean) => {
    addLog(`🎤 Recording status changed: ${isActive ? 'ACTIVE' : 'INACTIVE'}`);
  };

  const getStatusBadge = (test: string, result: boolean | undefined) => {
    if (result === undefined) return <Badge variant="secondary">Pending</Badge>;
    return result ? <Badge variant="default" className="bg-green-500">Pass</Badge> : <Badge variant="destructive">Fail</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">WASAPI + Deepgram Debug Console</h1>
      
      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Environment Tests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={runComprehensiveDiagnostic} 
              disabled={isDiagnosticRunning || isTestRunning}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDiagnosticRunning ? 'Running Full Diagnostic...' : 'Full Pipeline Diagnostic'}
            </Button>
            <Button 
              onClick={runEnvironmentTest} 
              disabled={isTestRunning || isDiagnosticRunning}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {isTestRunning ? 'Running Tests...' : 'Run Environment Test'}
            </Button>
            <Button 
              onClick={testDeepgramDirectly} 
              disabled={isTestRunning || isDiagnosticRunning}
              variant="outline"
              className="bg-purple-500 hover:bg-purple-600 text-white"
            >
              Test Deepgram Direct
            </Button>
            <Button 
              onClick={testDirectTranscription} 
              variant="outline"
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              Test Transcription
            </Button>
            <Button onClick={clearLogs} variant="outline">
              Clear Logs
            </Button>
          </div>
          
          {/* Test Results */}
          {Object.keys(testResults).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">Browser Env</span>
                {getStatusBadge('browserEnv', testResults.browserEnv)}
              </div>
              <div className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">Media API</span>
                {getStatusBadge('mediaDevices', testResults.mediaDevices)}
              </div>
              <div className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">Env Vars</span>
                {getStatusBadge('envVars', testResults.envVars)}
              </div>
              <div className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">Mic Access</span>
                {getStatusBadge('micPermission', testResults.micPermission)}
              </div>
              <div className="flex items-center justify-between p-2 border rounded col-span-2">
                <span className="text-sm">Deepgram Connection</span>
                {getStatusBadge('deepgramConnection', testResults.deepgramConnection)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* WASAPI Recorder */}
      <Card>
        <CardHeader>
          <CardTitle>WASAPI Recorder Test</CardTitle>
        </CardHeader>
        <CardContent>
          <WASAPIRecorder
            addTextinTranscription={addTextinTranscription}
            onTranscriptionUpdate={onTranscriptionUpdate}
            onStatusChange={onStatusChange}
          />
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Logs ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 overflow-y-auto bg-gray-50 p-4 rounded font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet. Run tests or use the recorder to see activity.</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
