/**
 * Enhanced WASAPI Dual-Channel Recorder Component
 * Integrates WASAPI audio capture with Deepgram transcription
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MicIcon, MicOffIcon, Monitor, User, Wifi, WifiOff, Activity } from "lucide-react";
import { wasapiDeepgramHandler, DualChannelStatus, AudioLevels } from "@/lib/wasapiHandler";
import { ChatMessage } from "@/lib/transcriptionManager";

interface WASAPIRecorderProps {
  addTextinTranscription: (text: string, speaker?: 'user' | 'system' | 'external') => void;
  onTranscriptionUpdate?: (message: ChatMessage) => void;
  onStatusChange?: (isActive: boolean) => void;
}

export default function WASAPIRecorder({
  addTextinTranscription,
  onTranscriptionUpdate,
  onStatusChange
}: WASAPIRecorderProps) {
  // Component state
  const [isActive, setIsActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<DualChannelStatus | null>(null);
  const [audioLevels, setAudioLevels] = useState<AudioLevels>({ external: 0, system: 0 });
  const [connectionQuality, setConnectionQuality] = useState({ external: 'good', system: 'good' });
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  
  // Statistics
  const [stats, setStats] = useState({
    totalMessages: 0,
    uptime: 0,
    lastActivity: { external: 0, system: 0 }
  });

  // Refs
  const isRendered = useRef(false);
  const statsInterval = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize component
  useEffect(() => {
    if (isRendered.current) return;
    isRendered.current = true;
    
    setupEventHandlers();
    
    return () => {
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Setup event handlers
  const setupEventHandlers = useCallback(() => {
    // Transcription handler
    wasapiDeepgramHandler.onTranscription((message: ChatMessage) => {
      console.log('🎤 WASAPIRecorder: New transcription received:', message);
      
      // The WASAPI handler has already added this to transcriptionManager
      // So we just need to update the input field and notify parent
      const formattedText = ` [${new Date().toLocaleTimeString()}] ${message.text}`;
      console.log('🎤 WASAPIRecorder: Adding formatted text to input:', formattedText);
      
      // Add to transcription display (input field)
      addTextinTranscription(message.text, message.speaker);
      
      // Notify parent component
      console.log('🎤 WASAPIRecorder: Notifying parent component');
      onTranscriptionUpdate?.(message);
      
      // Update stats
      setStats(prev => ({
        ...prev,
        totalMessages: prev.totalMessages + 1
      }));
    });

    // Status update handler
    wasapiDeepgramHandler.onStatusUpdate((newStatus: DualChannelStatus) => {
      setStatus(newStatus);
      
      // Update connection quality
      const now = Date.now();
      const externalInactive = now - newStatus.external.lastActivity > 10000; // 10 seconds
      const systemInactive = now - newStatus.system.lastActivity > 10000;
      
      setConnectionQuality({
        external: newStatus.external.connected ? (externalInactive ? 'poor' : 'good') : 'disconnected',
        system: newStatus.system.connected ? (systemInactive ? 'poor' : 'good') : 'disconnected'
      });
      
      // Update stats
      setStats(prev => ({
        ...prev,
        uptime: newStatus.overall.totalDuration,
        lastActivity: {
          external: newStatus.external.lastActivity,
          system: newStatus.system.lastActivity
        }
      }));
    });

    // Audio levels handler
    wasapiDeepgramHandler.onAudioLevels((levels: AudioLevels) => {
      setAudioLevels(levels);
    });

    // Error handler
    wasapiDeepgramHandler.onError((error: Error, source: string) => {
      console.error(`❌ WASAPI Error (${source}):`, error);
      setError(`${source}: ${error.message}`);
      
      // Auto-clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    });
  }, [addTextinTranscription, onTranscriptionUpdate]);

  // Start/Stop toggle
  const toggleRecording = useCallback(async () => {
    if (isActive) {
      await stopRecordingWithScreen();
    } else {
      await startRecordingWithScreen();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      console.log('🎤 Starting WASAPI dual-channel recording...');
      
      await wasapiDeepgramHandler.start();
      
      setIsActive(true);
      onStatusChange?.(true);
      
      // Start stats updates
      startStatsUpdates();
      
      console.log('✅ WASAPI recording started');
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      setError(`Failed to start: ${(error as Error).message}`);
    } finally {
      setIsInitializing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onStatusChange]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      setIsInitializing(true);
      
      console.log('🛑 Stopping WASAPI recording...');
      
      await wasapiDeepgramHandler.stop();
      
      setIsActive(false);
      onStatusChange?.(false);
      
      // Stop stats updates
      if (statsInterval.current) {
        clearInterval(statsInterval.current);
        statsInterval.current = null;
      }
      
      console.log('✅ WASAPI recording stopped');
      
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      setError(`Failed to stop: ${(error as Error).message}`);
    } finally {
      setIsInitializing(false);
    }
  }, [onStatusChange]);

  // Start statistics updates
  const startStatsUpdates = useCallback(() => {
    statsInterval.current = setInterval(() => {
      const statistics = wasapiDeepgramHandler.getStatistics();
      const messages = wasapiDeepgramHandler.getTranscriptionHistory();
      
      setStats(prev => ({
        ...prev,
        totalMessages: messages.length,
        uptime: statistics.uptime
      }));
    }, 1000);
  }, []);

  // Restart specific channel
  const restartChannel = useCallback(async (channel: 'external' | 'system') => {
    try {
      setError(null);
      console.log(`🔄 Restarting ${channel} channel...`);
      
      await wasapiDeepgramHandler.restartChannel(channel);
      
      console.log(`✅ ${channel} channel restarted`);
      
    } catch (error) {
      console.error(`❌ Failed to restart ${channel}:`, error);
      setError(`Restart failed: ${(error as Error).message}`);
    }
  }, []);

  // Clear transcription
  const clearTranscription = useCallback(() => {
    wasapiDeepgramHandler.clearTranscriptionHistory();
    setStats(prev => ({ ...prev, totalMessages: 0 }));
  }, []);

  // Component cleanup
  const cleanup = useCallback(async () => {
    if (isActive) {
      await stopRecording();
    }
    
    if (statsInterval.current) {
      clearInterval(statsInterval.current);
    }
  }, [isActive, stopRecording]);

  // Get screen stream for display
  const getScreenStream = useCallback(async () => {
    try {
      // Get the system stream from wasapi manager
      const handler = wasapiDeepgramHandler;
      // We need to access the stream from the manager
      // For now, let's create a new display stream
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: 1920,
          height: 1080,
          frameRate: 30
        },
        audio: false // We don't need audio for display
      });
      
      setScreenStream(stream);
      
      // Set video source
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
      }
      
    } catch (error) {
      console.error('❌ Failed to get screen stream:', error);
      setError(`Screen sharing failed: ${(error as Error).message}`);
    }
  }, []);

  // Stop screen stream
  const stopScreenStream = useCallback(() => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [screenStream]);

  // Update startRecording to include screen capture
  const startRecordingWithScreen = useCallback(async () => {
    await startRecording();
    await getScreenStream();
  }, [startRecording, getScreenStream]);

  // Update stopRecording to stop screen
  const stopRecordingWithScreen = useCallback(async () => {
    stopScreenStream();
    await stopRecording();
  }, [stopRecording, stopScreenStream]);

  // Audio level visualization
  const renderAudioLevel = (level: number, color: string) => {
    const percentage = Math.min(level * 100, 100);
    return (
      <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-150 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  };

  // Connection status indicator
  const getConnectionIcon = (quality: string) => {
    switch (quality) {
      case 'good': return <Wifi className="w-4 h-4 text-green-500" />;
      case 'poor': return <Activity className="w-4 h-4 text-yellow-500" />;
      case 'disconnected': return <WifiOff className="w-4 h-4 text-red-500" />;
      default: return <WifiOff className="w-4 h-4 text-gray-400" />;
    }
  };

  // Format uptime
  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Main Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-gray-800">
            Screen Share & Audio
          </h3>
          {isActive && (
            <div className="flex items-center space-x-2 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Recording Active</span>
            </div>
          )}
        </div>
        
        <Button
          onClick={toggleRecording}
          disabled={isInitializing}
          className={cn(
            "px-6 py-2 font-medium transition-all",
            isActive 
              ? "bg-red-600 hover:bg-red-700 text-white" 
              : "bg-blue-600 hover:bg-blue-700 text-white"
          )}
        >
          {isInitializing ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Initializing...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              {isActive ? <MicOffIcon className="w-4 h-4" /> : <MicIcon className="w-4 h-4" />}
              <span>{isActive ? "Disconnect" : "Connect & Share Screen"}</span>
            </div>
          )}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3">
          <div className="flex items-center space-x-2">
            <span className="text-red-500">⚠️</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Status Display */}
      {isActive && status && (
        <div className="bg-gray-50 border border-gray-200 p-4 space-y-4">
          {/* Channel Status */}
          <div className="grid grid-cols-2 gap-4">
            {/* Interviewer Channel */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Interviewer</span>
                </div>
                {getConnectionIcon(connectionQuality.external)}
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">Level:</span>
                {renderAudioLevel(audioLevels.external, 'bg-blue-500')}
                <span className="text-xs text-gray-500">
                  {Math.round(audioLevels.external * 100)}%
                </span>
              </div>
              {connectionQuality.external !== 'good' && (
                <Button
                  onClick={() => restartChannel('external')}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  Reconnect
                </Button>
              )}
            </div>

            {/* Me Channel */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Monitor className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Me</span>
                </div>
                {getConnectionIcon(connectionQuality.system)}
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">Level:</span>
                {renderAudioLevel(audioLevels.system, 'bg-green-500')}
                <span className="text-xs text-gray-500">
                  {Math.round(audioLevels.system * 100)}%
                </span>
              </div>
              {connectionQuality.system !== 'good' && (
                <Button
                  onClick={() => restartChannel('system')}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  Reconnect
                </Button>
              )}
            </div>
          </div>

          {/* Statistics */}
          <div className="border-t border-gray-200 pt-3">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-gray-800">{stats.totalMessages}</div>
                <div className="text-xs text-gray-500">Messages</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-800">{formatUptime(stats.uptime)}</div>
                <div className="text-xs text-gray-500">Uptime</div>
              </div>
              <div>
                <Button
                  onClick={clearTranscription}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  Clear History
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screen Display */}
      {isActive && (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between bg-gray-800 px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-white text-sm font-medium">Live Screen</span>
            </div>
            <div className="text-gray-400 text-xs">
              {screenStream ? 'Screen sharing active' : 'No screen stream'}
            </div>
          </div>
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}> {/* 16:9 aspect ratio */}
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-contain bg-black"
              autoPlay
              muted
              playsInline
            />
            {!screenStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="text-center text-gray-400">
                  <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No Screen Stream</p>
                  <p className="text-sm">Screen sharing will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      {!isActive && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-600">
            Click &ldquo;Connect &amp; Share Screen&rdquo; to start system audio capture and transcription
          </p>
          <p className="text-xs text-gray-500 mt-1">
            This will capture interviewer audio and display the shared screen
          </p>
        </div>
      )}
    </div>
  );
}
