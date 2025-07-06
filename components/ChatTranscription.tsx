"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { User, Monitor, MessageCircle } from "lucide-react";

export interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  speaker: 'user' | 'system' | 'external';
  isInterim?: boolean;
}

interface ChatTranscriptionProps {
  messages: ChatMessage[];
  onClear: () => void;
  className?: string;
}

export function ChatTranscription({ messages, onClear, className }: ChatTranscriptionProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [renderKey, setRenderKey] = useState(0);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setRenderKey(prev => prev + 1);
  }, [messages]);

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-blue-50">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          <h3 className="font-semibold text-gray-800 text-lg">📝 Interview Transcript</h3>
          <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded">
            {messages.length} entries
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={onClear}
            variant="outline"
            size="sm"
            className="text-sm"
          >
            Clear Transcript
          </Button>
        </div>
      </div>

      {/* Transcript Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-3">🎙️</div>
              <p className="text-lg font-medium mb-2">Interview Transcript</p>
              <p className="text-sm">Start speaking to see the live transcription...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className="bg-white rounded-lg p-4 shadow-sm border"
              >
                {/* Timestamp */}
                <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                  <span className="font-medium">#{index + 1}</span>
                  <span>•</span>
                  <span>{formatTime(message.timestamp)}</span>
                  <span>•</span>
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    message.isInterim 
                      ? "bg-yellow-100 text-yellow-700" 
                      : "bg-green-100 text-green-700"
                  )}>
                    {message.isInterim ? "Speaking..." : "Complete"}
                  </span>
                </div>
                
                {/* Transcript Text */}
                <div className={cn(
                  "text-gray-800 leading-relaxed",
                  message.isInterim && "italic text-gray-600"
                )}>
                  {message.text || "(No speech detected)"}
                  {message.isInterim && (
                    <span className="ml-1 text-gray-400 animate-pulse">...</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
