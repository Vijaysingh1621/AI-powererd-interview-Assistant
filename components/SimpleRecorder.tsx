/**
 * Simple Screen Audio Recorder Component
 * Uses browser getDisplayMedia for audio capture with Deepgram real-time transcription
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Monitor, Wifi, WifiOff, Activity, Square } from "lucide-react";
import { deepgramClient, ConnectionStatus, SimpleTranscriptionResult } from "@/lib/simpleDeepgramClient";
import { ChatMessage } from "@/lib/transcriptionManager";

interface SimpleRecorderProps {
  addTextinTranscription: (text: string, speaker?: 'user' | 'system' | 'external') => void;
  onTranscriptionUpdate?: (message: ChatMessage) => void;
  onStatusChange?: (isActive: boolean) => void;
}

export default function SimpleRecorder({
  addTextinTranscription,
  onTranscriptionUpdate,
  onStatusChange
}: SimpleRecorderProps) {
  // Component state
  const [isActive, setIsActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  
  // Statistics
  const [stats, setStats] = useState({
    totalMessages: 0,
    uptime: 0,
    lastActivity: 0
  });

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const statsInterval = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number>(0);

  // Initialize Deepgram handlers
  useEffect(() => {
    // Deepgram connection status handler
    deepgramClient.onStatusChange((status: ConnectionStatus) => {
      setConnectionStatus(status);
    });

    // Deepgram transcript handler
    deepgramClient.onTranscript((result: SimpleTranscriptionResult) => {
      if (result.text && result.text.trim()) {
        // All transcription is from the interviewer (screen audio)
        const message: ChatMessage = {
          id: Date.now().toString(),
          text: result.text,
          speaker: 'external', // Use external for interviewer
          timestamp: new Date().toISOString(),
          isInterim: !result.isFinal
        };

        if (onTranscriptionUpdate) {
          onTranscriptionUpdate(message);
        }

        // Update stats
        setStats(prev => ({
          ...prev,
          totalMessages: prev.totalMessages + (result.isFinal ? 1 : 0),
          lastActivity: Date.now()
        }));
      }
    });

    // Deepgram error handler
    deepgramClient.onError((error: Error) => {
      console.error('Deepgram error:', error);
      setError(`Transcription error: ${error.message}`);
    });

    return () => {
      cleanup();
    };
  }, [onTranscriptionUpdate]);

  // Update uptime statistics
  useEffect(() => {
    if (isActive) {
      startTime.current = Date.now();
      statsInterval.current = setInterval(() => {
        setStats(prev => ({
          ...prev,
          uptime: Math.floor((Date.now() - startTime.current) / 1000)
        }));
      }, 1000);
    } else {
      if (statsInterval.current) {
        clearInterval(statsInterval.current);
        statsInterval.current = null;
      }
    }

    return () => {
      if (statsInterval.current) {
        clearInterval(statsInterval.current);
      }
    };
  }, [isActive]);

  // Status change callback
  useEffect(() => {
    onStatusChange?.(isActive);
  }, [isActive, onStatusChange]);

  // Start recording function
  const startRecording = useCallback(async () => {
    try {
      setIsInitializing(true);
      setError(null);

      // Request screen sharing with audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
          channelCount: 1
        }
      });

      setScreenStream(stream);

      // Display video in the video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Connect to Deepgram
      await deepgramClient.connect();

      // Get audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track found in screen share. Please share a tab or window with audio.');
      }

      // Create MediaRecorder to capture audio
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;

      // Handle audio data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && deepgramClient.isConnected()) {
          // Convert Blob to ArrayBuffer and send to Deepgram
          event.data.arrayBuffer().then((buffer) => {
            deepgramClient.send(new Uint8Array(buffer));
          });
        }
      };

      // Start recording with small chunks for real-time processing
      mediaRecorder.start(100); // 100ms chunks

      // Handle stream ending
      stream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

      setIsActive(true);
      setIsInitializing(false);

    } catch (error) {
      console.error('Failed to start recording:', error);
      setError(error instanceof Error ? error.message : 'Failed to start recording');
      setIsInitializing(false);
    }
  }, []);

  // Stop recording function
  const stopRecording = useCallback(async () => {
    try {
      setIsActive(false);

      // Stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // Stop screen stream
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
      }

      // Disconnect from Deepgram
      await deepgramClient.disconnect();

      // Clear video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

    } catch (error) {
      console.error('Error stopping recording:', error);
      setError(error instanceof Error ? error.message : 'Error stopping recording');
    }
  }, [screenStream]);

  // Cleanup function
  const cleanup = useCallback(() => {
    stopRecording();
    if (statsInterval.current) {
      clearInterval(statsInterval.current);
    }
  }, [stopRecording]);

  // Connection status color
  const getConnectionColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-500';
      case 'connecting': return 'text-yellow-500';
      default: return 'text-red-500';
    }
  };

  // Connection status icon
  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="w-4 h-4" />;
      case 'connecting': return <Activity className="w-4 h-4 animate-pulse" />;
      default: return <WifiOff className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Section */}
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Interview Recorder
          </h3>
          <div className={cn("flex items-center gap-2 text-sm", getConnectionColor())}>
            {getConnectionIcon()}
            <span className="capitalize">{connectionStatus}</span>
          </div>
        </div>

        {/* Main Control Button */}
        <Button
          onClick={isActive ? stopRecording : startRecording}
          disabled={isInitializing}
          className={cn(
            "w-full h-12 text-base font-medium transition-all",
            isActive
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          )}
        >
          {isInitializing ? (
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 animate-spin" />
              Initializing...
            </div>
          ) : isActive ? (
            <div className="flex items-center gap-2">
              <Square className="w-4 h-4" />
              Stop Recording
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Connect & Share Screen
            </div>
          )}
        </Button>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Screen Sharing Video */}
      {screenStream && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Live Screen Share</h4>
          <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
            {isActive && (
              <div className="absolute top-3 right-3 flex items-center gap-2 bg-red-500 text-white px-2 py-1 rounded text-xs">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                LIVE
              </div>
            )}
          </div>
        </div>
      )}

      {/* Statistics */}
      {isActive && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-gray-600">Messages</div>
            <div className="text-lg font-medium">{stats.totalMessages}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-gray-600">Uptime</div>
            <div className="text-lg font-medium">
              {Math.floor(stats.uptime / 60)}:{(stats.uptime % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
