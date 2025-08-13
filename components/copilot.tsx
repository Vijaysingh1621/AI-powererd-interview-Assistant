"use client"
import type React from "react"

import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import RecorderTranscriber from "@/components/recorder"
import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Settings, Save, Eye, EyeOff, Zap, Brain, HelpCircle, CheckCircle, Send, Mic, MicOff } from "lucide-react"

import { FLAGS, type HistoryData } from "@/lib/types"
import { Switch } from "@/components/ui/switch"
import { PDFManager } from "@/components/PDFManager"
import { PDFModal } from "@/components/PDFModal"
import { transcriptionManager, type ChatMessage } from "@/lib/transcriptionManager"
import { ChatTranscription } from "@/components/ChatTranscription"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface CopilotProps {
  addInSavedData: (data: HistoryData) => void
}

// Custom hook to replace useCompletion
function useGeminiCompletion(body: any) {
  const [completion, setCompletion] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const [input, setInput] = useState<string>("")
  const [extractedQuestion, setExtractedQuestion] = useState<string>("")
  const [citations, setCitations] = useState<any[]>([])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim()) return

      setIsLoading(true)
      setError(null)
      setCompletion("")
      setExtractedQuestion("")
      setCitations([])

      try {
        const response = await fetch("/api/completion", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...body,
            prompt: input,
          }),
        })

        if (!response.ok) {
          if (response.status === 503) {
            const errorData = await response.json()
            setCompletion("⚠️ AI service is temporarily unavailable. Please try again in a moment.")

            if (errorData.extractedQuestion) {
              setExtractedQuestion(errorData.extractedQuestion)
            }
            if (errorData.citations && errorData.citations.length > 0) {
              setCitations(errorData.citations)
            }
            return
          }
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          throw new Error("No response body")
        }

        let result = ""
        let buffer = ""
        let isInSources = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk

          if (buffer.includes("---SOURCES---")) {
            const parts = buffer.split("---SOURCES---")
            const beforeSources = parts[0]
            const afterSources = parts[1] || ""

            if (beforeSources && !isInSources) {
              result += beforeSources
              setCompletion(result)
            }

            isInSources = true
            if (afterSources.trim()) {
              try {
                const parsed = JSON.parse(afterSources.trim())
                if (parsed.type === "citations") {
                  setCitations(parsed.citations)
                  if (parsed.extractedQuestion) {
                    setExtractedQuestion(parsed.extractedQuestion)
                  }
                }
              } catch (e) {
                // Continue processing
              }
            }
            buffer = ""
            continue
          }

          if (!isInSources) {
            result += chunk
            setCompletion(result)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"))
      } finally {
        setIsLoading(false)
      }
    },
    [input, body],
  )

  const stop = useCallback(() => {
    setIsLoading(false)
  }, [])

  return {
    completion,
    isLoading,
    error,
    input,
    setInput,
    handleSubmit,
    stop,
    extractedQuestion,
    citations,
  }
}

export function Copilot({ addInSavedData }: CopilotProps) {
  const [transcribedText, setTranscribedText] = useState<string>("")
  const [flag, setFlag] = useState<FLAGS>(FLAGS.COPILOT)
  const [bg, setBg] = useState<string>("")
  const [lastAddedText, setLastAddedText] = useState<string>("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [stealthMode, setStealthMode] = useState<boolean>(false)
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean
    filename: string
    page?: number
    citation?: any
  }>({
    isOpen: false,
    filename: "",
    page: undefined,
    citation: undefined,
  })

  const formRef = useRef<HTMLFormElement>(null)

  const { completion, stop, isLoading, error, input, setInput, handleSubmit, extractedQuestion, citations } =
    useGeminiCompletion({
      bg,
      flag,
    })

  const handleFlag = useCallback((checked: boolean) => {
    if (!checked) {
      setFlag(FLAGS.SUMMERIZER)
    } else {
      setFlag(FLAGS.COPILOT)
    }
  }, [])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.ctrlKey) {
      switch (event.key) {
        case "Enter":
          event.preventDefault()
          if (formRef.current) {
            const submitEvent = new Event("submit", {
              cancelable: true,
              bubbles: true,
            })
            formRef.current.dispatchEvent(submitEvent)
          }
          break
        case "s":
          event.preventDefault()
          setFlag(FLAGS.SUMMERIZER)
          break
        case "c":
          event.preventDefault()
          setFlag(FLAGS.COPILOT)
          break
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleKeyDown])

  useEffect(() => {
    const interval = setInterval(() => {
      setChatMessages(transcriptionManager.getMessages())
    }, 500)

    return () => clearInterval(interval)
  }, [])

  const addTextinTranscription = (text: string, speaker: "user" | "system" | "external" = "external") => {
    const formattedText = transcriptionManager.formatWithTimestamp(text)

    setInput((prev) => prev + formattedText)
    setTranscribedText((prev) => prev + formattedText)
    setLastAddedText(text)

    setChatMessages(transcriptionManager.getMessages())
  }

  const addSpeakerLabel = (speaker: string) => {
    const label = `\n\n--- ${speaker} ---\n`
    setInput((prev) => prev + label)
    setTranscribedText((prev) => prev + label)
  }

  const openPDFModal = (filename: string, page?: number, citation?: any) => {
    setPdfModal({
      isOpen: true,
      filename,
      page,
      citation,
    })
  }

  const closePDFModal = () => {
    setPdfModal({
      isOpen: false,
      filename: "",
      page: undefined,
      citation: undefined,
    })
  }

  const handleTranscriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    setTranscribedText(e.target.value)
  }

  const clearTranscriptionChange = () => {
    setInput("")
    setTranscribedText("")
    setLastAddedText("")
    transcriptionManager.reset()
    setChatMessages([])
  }

  useEffect(() => {
    const savedBg = localStorage.getItem("bg")
    if (savedBg) {
      setBg(savedBg)
    }
  }, [])

  useEffect(() => console.log(flag), [flag])

  useEffect(() => {
    if (!bg) return
    localStorage.setItem("bg", bg)
  }, [bg])

  const handleSave = () => {
    addInSavedData({
      createdAt: new Date().toISOString(),
      data: completion,
      tag: flag === FLAGS.COPILOT ? "AI Mode" : "Summerizer",
    })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === "KeyC") {
        setStealthMode((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Stealth mode
  if (stealthMode) {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
        onClick={() => setStealthMode(false)}
        title="Show Copilot (Ctrl+Shift+C)"
      >
        <Eye className="size-5" />
      </motion.button>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground">
              B
            </div>
            <div>
              <h1 className="text-lg font-semibold">BlitzQ Copilot</h1>
              <p className="text-xs text-muted-foreground">AI Interview Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {error && (
              <Badge variant="destructive" className="text-xs">
                ⚠️ {error.message}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStealthMode(true)}
              title="Stealth Mode (Ctrl+Shift+C)"
            >
              <EyeOff className="size-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Section - Audio & Transcription (50% width) */}
        <div className="w-1/2 border-r bg-muted/10 flex flex-col overflow-hidden">
          {/* PDF Upload at top */}
          <div className="p-4 border-b bg-background/50 flex-shrink-0">
            <h3 className="text-sm font-medium mb-3">Knowledge Base</h3>
            <PDFManager />
          </div>

          {/* Audio Recording - Compact */}
          <div className="p-4 border-b bg-background/50 flex-shrink-0">
            <h3 className="text-sm font-medium mb-3">Audio Connection</h3>
            <div className="text-xs text-muted-foreground mb-2">
              Connect with Google Meet, Zoom, Teams, or any screen sharing platform
            </div>
            <RecorderTranscriber addTextinTranscription={addTextinTranscription} />
          </div>

          {/* Chat Transcription - Takes half of remaining space */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 pb-2 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Live Transcription</h3>
                <Button variant="ghost" size="sm" onClick={clearTranscriptionChange}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="flex-1 px-4 pb-4 min-h-0">
              <div className="h-full border rounded-lg bg-background overflow-y-auto">
                <ChatTranscription 
                  messages={chatMessages} 
                  onClear={clearTranscriptionChange} 
                  className="h-full"
                  autoScroll={false}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Section - AI Chat & Input (50% width) */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {/* AI Mode Toggle */}
          <div className="p-4 border-b bg-background/50 flex-shrink-0">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium text-muted-foreground">
                  Summarizer
                  <span className="text-xs text-muted-foreground/70 ml-1">(Ctrl+S)</span>
                </Label>
                <Switch
                  className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
                  onCheckedChange={handleFlag}
                  defaultChecked
                  checked={flag === FLAGS.COPILOT}
                />
                <Label className="text-sm font-medium text-muted-foreground">
                  AI Mode
                  <span className="text-xs text-muted-foreground/70 ml-1">(Ctrl+C)</span>
                </Label>
              </div>
            </div>
          </div>

          {/* AI Chat Response Area - Takes most space with scrolling */}
          <div className="flex-1 flex flex-col min-h-0 p-4">
            <h3 className="text-sm font-medium mb-3 flex-shrink-0">AI Assistant</h3>
            <div className="flex-1 border rounded-lg bg-background p-4 overflow-y-auto min-h-0 space-y-4">
              {/* Extracted Question */}
              {extractedQuestion && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="border-l-4 border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-r-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <HelpCircle className="size-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Question Detected</span>
                    </div>
                    <p className="text-sm italic text-blue-900 dark:text-blue-100">
                      &ldquo;{extractedQuestion}&rdquo;
                    </p>
                  </div>
                </motion.div>
              )}

              {/* AI Response */}
              {completion && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="border-l-4 border-green-500 bg-green-50/50 dark:bg-green-950/20 p-3 rounded-r-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="size-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">AI Response</span>
                        {flag === FLAGS.COPILOT && (
                          <Badge variant="secondary" className="text-xs">
                            🤖 RAG-powered
                          </Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleSave}>
                        <Save className="size-3" />
                      </Button>
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground bg-white dark:bg-gray-800 p-3 rounded border">
                      {completion}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Citations */}
              {citations && citations.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="border-l-4 border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-r-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Sources & Citations</span>
                      <Badge variant="secondary" className="text-xs">
                        {citations.length} found
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {citations.map((citation, index) => (
                        <div
                          key={index}
                          className="bg-white dark:bg-gray-800 p-3 rounded border border-amber-100 dark:border-amber-800"
                        >
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className="text-xs font-bold">
                              {index + 1}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                {citation.sourceType === "pdf" ? (
                                  <Badge className="text-xs bg-blue-100 text-blue-800">
                                    📄 PDF
                                  </Badge>
                                ) : (
                                  <Badge className="text-xs bg-green-100 text-green-800">
                                    🌐 Web
                                  </Badge>
                                )}
                                <span className="font-medium text-xs truncate">
                                  {citation.filename || citation.source}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {citation.contextSnippet || citation.content.substring(0, 150)}...
                              </p>
                              {citation.sourceType === "pdf" && citation.filename && citation.page && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-6 mt-2"
                                  onClick={() => openPDFModal(citation.filename, citation.page, citation)}
                                >
                                  📖 Page {citation.page}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Loading indicator */}
              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="border-l-4 border-gray-300 bg-gray-50/50 dark:bg-gray-950/20 p-3 rounded-r-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-muted-foreground">AI is thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}
              
              {/* Empty state */}
              {!completion && !extractedQuestion && !isLoading && citations.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Brain className="size-12 text-muted-foreground/50 mb-4" />
                  <h4 className="text-lg font-medium text-muted-foreground mb-2">AI Assistant Ready</h4>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Ask questions, paste transcripts, or let the AI analyze your conversation in real-time.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Manual Search Input - Fixed at bottom */}
          <div className="p-4 border-t bg-background/50 flex-shrink-0">
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question or paste transcript here..."
                  className="w-full p-3 pr-12 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background min-h-[80px] max-h-[120px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <Button 
                  type="submit" 
                  size="sm" 
                  className="absolute bottom-2 right-2 h-8 w-8 p-0"
                  disabled={isLoading || !input.trim()}
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Press Ctrl+Enter to send</span>
                <div className="flex items-center gap-2">
                  {flag === FLAGS.COPILOT ? (
                    <>
                      <Brain className="size-3" />
                      <span>AI Mode active</span>
                    </>
                  ) : (
                    <>
                      <Zap className="size-3" />
                      <span>Summarizer active</span>
                    </>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      <PDFModal
        isOpen={pdfModal.isOpen}
        onClose={closePDFModal}
        filename={pdfModal.filename}
        page={pdfModal.page}
        citation={pdfModal.citation}
      />
    </div>
  )
}
