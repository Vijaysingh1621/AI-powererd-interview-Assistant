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

  const getSpeakerInfo = (speaker: string) => {
    switch (speaker) {
      case 'user':
      case 'external':
        return {
          name: 'Interviewer',
          icon: User,
          bgColor: 'bg-blue-500',
          textColor: 'text-blue-600',
          alignment: 'justify-start'
        };
      case 'system':
        return {
          name: 'Me',
          icon: Monitor,
          bgColor: 'bg-green-500',
          textColor: 'text-green-600',
          alignment: 'justify-end'
        };
      default:
        return {
          name: 'Unknown',
          icon: MessageCircle,
          bgColor: 'bg-gray-500',
          textColor: 'text-gray-600',
          alignment: 'justify-start'
        };
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <h3 className="font-medium text-gray-700">Live Transcription</h3>
          <span className="text-xs text-gray-500">({messages.length} messages)</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={onClear}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            Clear Chat
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="px-3 py-2 bg-gray-50 border-b text-xs text-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3 text-blue-600" />
            <span>Interviewer (Left)</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Me (Right)</span>
            <Monitor className="w-3 h-3 text-green-600" />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-3 space-y-3"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="text-2xl mb-2">🎙️</div>
              <p className="text-sm">Start listening to see transcription...</p>
              <p className="text-xs mt-1">Interviewer will appear on the left, your audio on the right</p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const speakerInfo = getSpeakerInfo(message.speaker);
            const IconComponent = speakerInfo.icon;

            return (
              <div
                key={message.id}
                className={cn("flex", speakerInfo.alignment)}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 shadow-sm",
                    message.speaker === 'system' 
                      ? "bg-green-100 ml-auto" 
                      : "bg-blue-100 mr-auto",
                    message.isInterim && "opacity-70 italic"
                  )}
                >
                  {/* Speaker header */}
                  <div className={cn(
                    "flex items-center gap-1 mb-1 text-xs font-medium",
                    speakerInfo.textColor
                  )}>
                    <IconComponent className="w-3 h-3" />
                    <span>{speakerInfo.name}</span>
                    <span className="text-gray-400 ml-auto">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                  
                  {/* Message text */}
                  <div className={cn(
                    "text-sm text-gray-800",
                    message.isInterim && "text-gray-600"
                  )}>
                    {message.text}
                    {message.isInterim && (
                      <span className="ml-1 text-gray-400">...</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
