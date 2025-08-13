"use client"

import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { User, Monitor, MessageCircle, Trash2 } from "lucide-react"

export interface ChatMessage {
  id: string
  text: string
  timestamp: string
  speaker: "user" | "system" | "external"
  isInterim?: boolean
}

interface ChatTranscriptionProps {
  messages: ChatMessage[]
  onClear: () => void
  className?: string
  autoScroll?: boolean
}

export function ChatTranscription({ messages, onClear, className, autoScroll = true }: ChatTranscriptionProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, autoScroll])

  // Also scroll when container is resized (useful for layout changes)
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      const timeoutId = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [autoScroll])

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    } catch {
      return timestamp
    }
  }

  const getSpeakerInfo = (speaker: string) => {
    switch (speaker) {
      case "user":
      case "external":
        return {
          name: "Interviewer",
          icon: User,
          bgColor: "bg-blue-500",
          textColor: "text-blue-600 dark:text-blue-400",
          messageBg: "bg-blue-50 dark:bg-blue-950/30",
          alignment: "justify-start",
        }
      case "system":
        return {
          name: "Me",
          icon: Monitor,
          bgColor: "bg-green-500",
          textColor: "text-green-600 dark:text-green-400",
          messageBg: "bg-green-50 dark:bg-green-950/30",
          alignment: "justify-end",
        }
      default:
        return {
          name: "Unknown",
          icon: MessageCircle,
          bgColor: "bg-gray-500",
          textColor: "text-gray-600 dark:text-gray-400",
          messageBg: "bg-gray-50 dark:bg-gray-950/30",
          alignment: "justify-start",
        }
    }
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <h3 className="font-medium text-sm">Live Transcription</h3>
          <Badge variant="secondary" className="text-xs">
            {messages.length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-xs">
          <Trash2 className="size-3 mr-1" />
          Clear
        </Button>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <div className="text-2xl mb-2">🎙️</div>
              <p className="text-sm font-medium mb-1">Waiting for audio...</p>
              <p className="text-xs">Transcription will appear here</p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const speakerInfo = getSpeakerInfo(message.speaker)
            const IconComponent = speakerInfo.icon

            return (
              <div key={message.id} className={cn("flex", speakerInfo.alignment)}>
                <div
                  className={cn(
                    "max-w-[90%] rounded-lg px-3 py-2 shadow-sm border border-border/40",
                    speakerInfo.messageBg,
                    message.isInterim && "opacity-70 italic",
                  )}
                >
                  {/* Speaker header */}
                  <div className={cn("flex items-center gap-2 mb-1 text-xs font-medium", speakerInfo.textColor)}>
                    <IconComponent className="w-3 h-3" />
                    <span>{speakerInfo.name}</span>
                    <span className="text-muted-foreground ml-auto">{formatTime(message.timestamp)}</span>
                  </div>

                  {/* Message text */}
                  <div
                    className={cn(
                      "text-sm leading-relaxed",
                      message.isInterim ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {message.text}
                    {message.isInterim && <span className="ml-1 text-muted-foreground">...</span>}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
