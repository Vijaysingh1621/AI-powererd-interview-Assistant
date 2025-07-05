"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import RecorderTranscriber from "@/components/recorder";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { FLAGS, HistoryData } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { PDFManager } from "@/components/PDFManager";
import { PDFModal } from "@/components/PDFModal";
import { transcriptionManager, ChatMessage } from "@/lib/transcriptionManager";
import { ChatTranscription } from "@/components/ChatTranscription";

// Dynamically import WASAPIRecorder to avoid SSR issues
const WASAPIRecorder = dynamic(() => import("@/components/WASAPIRecorder"), {
  ssr: false,
  loading: () => <div className="text-sm text-gray-500">Loading WASAPI recorder...</div>
});

interface CopilotProps {
  addInSavedData: (data: HistoryData) => void;
}

// Custom hook to replace useCompletion
function useGeminiCompletion(body: any) {
  const [completion, setCompletion] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [input, setInput] = useState<string>("");
  const [extractedQuestion, setExtractedQuestion] = useState<string>("");
  const [citations, setCitations] = useState<any[]>([]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    setError(null);
    setCompletion("");
    setExtractedQuestion("");
    setCitations([]);

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
      });

      if (!response.ok) {
        // Handle error responses (like 503 for overloaded API)
        if (response.status === 503) {
          const errorData = await response.json();
          setCompletion("⚠️ Claude API is currently overloaded. Please try again in a moment.");
          
          if (errorData.extractedQuestion) {
            setExtractedQuestion(errorData.extractedQuestion);
          }
          if (errorData.citations && errorData.citations.length > 0) {
            setCitations(errorData.citations);
          }
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let result = "";
      let buffer = "";
      let isInCitations = false;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Check for citations separator
        if (buffer.includes('---CITATIONS---')) {
          const parts = buffer.split('---CITATIONS---');
          const beforeCitations = parts[0];
          const afterCitations = parts[1] || '';
          
          // Process content before citations
          if (beforeCitations && !isInCitations) {
            const lines = beforeCitations.split('\n');
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const parsed = JSON.parse(line);
                  if (parsed.type === 'question') {
                    setExtractedQuestion(parsed.question);
                  }
                } catch {
                  // Not JSON, regular response text
                  if (!line.includes('{') && !line.includes('}') && line.trim()) {
                    if (!result.includes(line.trim())) {
                      result += line;
                      setCompletion(result);
                    }
                  }
                }
              }
            }
          }
          
          // Process citations
          isInCitations = true;
          if (afterCitations.trim()) {
            try {
              const parsed = JSON.parse(afterCitations.trim());
              if (parsed.type === 'citations') {
                setCitations(parsed.citations);
              }
            } catch (e) {
              // Continue processing
            }
          }
          buffer = '';
          continue;
        }
        
        if (isInCitations) {
          // We're processing citations, accumulate buffer
          continue;
        }
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === 'question') {
                setExtractedQuestion(parsed.question);
              } else if (parsed.type === 'citations') {
                setCitations(parsed.citations);
              }
            } catch {
              // Not JSON, treat as regular response text
              if (!line.includes('{') && !line.includes('}') && line.trim()) {
                if (!result.includes(line.trim())) {
                  result += line;
                  setCompletion(result);
                }
              }
            }
          }
        }
        
        // Process the current chunk if it's not JSON and not citations
        if (!chunk.includes('{') && !chunk.includes('}') && !chunk.includes('---CITATIONS---') && chunk.trim()) {
          if (!result.includes(chunk.trim())) {
            result += chunk;
            setCompletion(result);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [input, body]);

  const stop = useCallback(() => {
    setIsLoading(false);
  }, []);

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
  };
}

export function Copilot({ addInSavedData }: CopilotProps) {
  const [transcribedText, setTranscribedText] = useState<string>("");
  const [flag, setFlag] = useState<FLAGS>(FLAGS.COPILOT);
  const [bg, setBg] = useState<string>("");
  const [lastAddedText, setLastAddedText] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showChatView, setShowChatView] = useState<boolean>(true);
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean, 
    filename: string, 
    page?: number, 
    citation?: any
  }>({
    isOpen: false,
    filename: '',
    page: undefined,
    citation: undefined
  });

  const { completion, stop, isLoading, error, setInput, handleSubmit, extractedQuestion, citations } =
    useGeminiCompletion({
      bg,
      flag,
    });

  const handleFlag = useCallback((checked: boolean) => {
    if (!checked) {
      setFlag(FLAGS.SUMMERIZER);
    } else {
      setFlag(FLAGS.COPILOT);
    }
  }, []);

  const formRef = useRef<HTMLFormElement>(null);
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.ctrlKey) {
      switch (event.key) {
        case "Enter":
          event.preventDefault();
          if (formRef.current) {
            const submitEvent = new Event("submit", {
              cancelable: true,
              bubbles: true,
            });
            formRef.current.dispatchEvent(submitEvent);
          }
          break;
        case "s":
          event.preventDefault();
          setFlag(FLAGS.SUMMERIZER);
          break;
        case "c":
          event.preventDefault();
          setFlag(FLAGS.COPILOT);
          break;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Update chat messages periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setChatMessages(transcriptionManager.getMessages());
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const addTextinTranscription = (text: string, speaker: 'user' | 'system' | 'external' = 'external') => {
    console.log('🎯 addTextinTranscription called:', { text, speaker });
    
    // Use the transcription manager to format and prevent duplicates
    const formattedText = transcriptionManager.formatWithTimestamp(text);
    console.log('📝 Formatted text:', formattedText);
    
    setInput((prev) => {
      const newValue = prev + formattedText;
      console.log('📥 Input updated:', newValue.slice(-100)); // Log last 100 chars
      return newValue;
    });
    
    setTranscribedText((prev) => {
      const newValue = prev + formattedText;
      console.log('📜 Transcribed text updated:', newValue.slice(-100)); // Log last 100 chars
      return newValue;
    });
    
    setLastAddedText(text); // Keep track for additional safety
    
    // Update chat messages from transcription manager
    const messages = transcriptionManager.getMessages();
    console.log('💬 Chat messages updated:', messages.length, 'messages');
    setChatMessages(messages);
  };

  const addSpeakerLabel = (speaker: string) => {
    const label = `\n\n--- ${speaker} ---\n`;
    setInput((prev) => prev + label);
    setTranscribedText((prev) => prev + label);
  };
  
  const openPDFModal = (filename: string, page?: number, citation?: any) => {
    setPdfModal({
      isOpen: true,
      filename,
      page,
      citation
    });
  };

  const closePDFModal = () => {
    setPdfModal({
      isOpen: false,
      filename: '',
      page: undefined,
      citation: undefined
    });
  };
  const handleTranscriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setInput(e.target.value);
    setTranscribedText(e.target.value);
  };

  const clearTranscriptionChange = () => {
    setInput("");
    setTranscribedText("");
    setLastAddedText(""); // Reset duplicate prevention
    transcriptionManager.reset(); // Reset transcription manager
    setChatMessages([]); // Clear chat messages
  };

  useEffect(() => {
    const savedBg = localStorage.getItem("bg");
    if (savedBg) {
      setBg(savedBg);
    }
  }, []);

  useEffect(() => console.log(flag), [flag]);

  useEffect(() => {
    if (!bg) return;
    localStorage.setItem("bg", bg);
  }, [bg]);

  const handleSave = () => {
    addInSavedData({
      createdAt: new Date().toISOString(),
      data: completion,
      tag: flag === FLAGS.COPILOT ? "AI Mode" : "Summerizer",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="px-2 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">🤖</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 font-poppins">
                AI Interview Assistant
              </h2>
              <p className="text-sm text-gray-600">Real-time interview support with RAG technology</p>
            </div>
          </div>
          {error && (
            <div className="bg-red-100 px-3 py-2">
              <p className="text-red-700 text-sm font-medium">⚠️ {error.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-2">
        <div className="grid gap-6 md:grid-cols-2">
        <div className="grid gap-1.5">
          <WASAPIRecorder
            addTextinTranscription={addTextinTranscription}
            onTranscriptionUpdate={(message) => {
              // Handle real-time transcription updates
              console.log('Real-time transcription:', message);
            }}
            onStatusChange={(isActive) => {
              // Handle recording status changes
              console.log('Recording status:', isActive);
            }}
          />
          
          {/* PDF Manager */}
          <div className="mt-4">
            <PDFManager />
          </div>
        </div>

        <div className="grid gap-1.5 my-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="transcription" className="text-green-800">
              Transcription
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => setShowChatView(!showChatView)}
              >
                {showChatView ? "📝 Text View" : "💬 Chat View"}
              </Button>
              <button
                type="button"
                className="text-xs text-red-500 hover:text-red-800 underline"
                onClick={clearTranscriptionChange}
              >
                clear
              </button>
            </div>
          </div>
          
          {showChatView ? (
            <div className="h-[300px]">
              <ChatTranscription 
                messages={chatMessages}
                onClear={clearTranscriptionChange}
                className="h-full"
              />
            </div>
          ) : (
            <>
              <Textarea
                id="transcription"
                className="h-[200px] min-h-[200px] mt-2"
                placeholder="Your transcribed text will appear here. Use the buttons below to mark who is speaking."
                value={transcribedText}
                onChange={handleTranscriptionChange}
              />
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 bg-blue-50 hover:bg-blue-100 text-blue-700"
                  onClick={() => addSpeakerLabel("INTERVIEWER")}
                >
                  Mark as Interviewer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 bg-green-50 hover:bg-green-100 text-green-700"
                  onClick={() => addSpeakerLabel("ME")}
                >
                  Mark as Me
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
        {/* Control Section */}
        <div className="px-2 py-4">
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex items-center justify-center gap-4"
          >
            <div className="flex items-center justify-center px-4 py-2">
              <Label className="text-gray-700 font-medium text-sm">
                Summarizer
                <span className="text-xs text-gray-500 ml-1">(Ctrl + S)</span>
              </Label>
              <Switch
                className="data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-gray-300 mx-3"
                onCheckedChange={handleFlag}
                defaultChecked
                checked={flag === FLAGS.COPILOT}
              />
              <Label className="text-gray-700 font-medium text-sm">
                AI Mode
                <span className="text-xs text-gray-500 ml-1">(Ctrl + C)</span>
              </Label>
            </div>

            <Button
              className="h-10 px-8 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              size="sm"
              variant="outline"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <span>Process</span>
                  <span className="text-xs text-blue-200 ml-2">(Ctrl + Enter)</span>
                </div>
              )}
            </Button>
          </form>
        </div>

        {/* Results Section */}
        <div className="px-2 pb-6">
          {/* Extracted Question Display */}
          {extractedQuestion && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-500">
                  <span className="text-white text-lg">❓</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-blue-800">Question Detected</h3>
                  <p className="text-xs text-blue-600">AI extracted this question from your conversation</p>
                </div>
              </div>
              <p className="text-base text-blue-900 font-medium italic bg-white p-3 border border-blue-200">
                &ldquo;{extractedQuestion}&rdquo;
              </p>
            </div>
          )}

          {/* AI Response */}
          {completion && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-green-500 flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">AI Response</h3>
                  {flag === FLAGS.COPILOT && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1">
                      🤖 RAG-powered
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium underline"
                  onClick={handleSave}
                >
                  Save Response
                </button>
              </div>
              <div className="bg-gray-50 p-6 border border-gray-200">
                <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">{completion}</div>
              </div>
            </>
          )}

        {/* Citations with Enhanced Context Information */}
        {citations && citations.length > 0 && (
          <div className="mt-4 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-100 rounded-full">
                <span className="text-lg">📚</span>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-yellow-800">Sources & Citations</h4>
                <p className="text-xs text-yellow-600">Found {citations.length} relevant source{citations.length > 1 ? 's' : ''}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {citations.map((citation, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-yellow-100 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Source Header */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          {citation.sourceType === 'pdf' ? (
                            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                              📄 PDF
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                              🌐 Web
                            </span>
                          )}
                          
                          <span className="font-medium text-gray-800 text-sm truncate">
                            {citation.filename || citation.source}
                          </span>
                        </div>
                        
                        {/* Page Information for PDFs */}
                        {citation.sourceType === 'pdf' && citation.pageRange && (
                          <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                            📖 {citation.pageRange}
                          </span>
                        )}
                        
                        {/* Relevance Score */}
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                          {Math.round(citation.score * 100)}% relevant
                        </span>
                      </div>
                      
                      {/* Content Preview */}
                      <div className="mb-3">
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {citation.contextSnippet || citation.content.substring(0, 200)}
                          {(citation.content.length > 200 && !citation.contextSnippet) ? "..." : ""}
                        </p>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {citation.url && citation.sourceType === 'web' && (
                          <a 
                            href={citation.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium rounded-md border border-blue-200 transition-colors"
                          >
                            🔗 View Source
                          </a>
                        )}
                        
                        {citation.sourceType === 'pdf' && citation.filename && citation.page && (
                          <button
                            onClick={() => openPDFModal(citation.filename, citation.page, citation)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-medium rounded-md border border-purple-200 transition-colors"
                          >
                            📖 Open Page {citation.page}
                          </button>
                        )}
                        
                        {/* Show additional pages if it's a range */}
                        {citation.sourceType === 'pdf' && citation.startPage && citation.endPage && citation.startPage !== citation.endPage && (
                          <span className="text-xs text-gray-500">
                            Content spans {citation.endPage - citation.startPage + 1} page{citation.endPage - citation.startPage > 0 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Summary Footer */}
            <div className="mt-4 pt-3 border-t border-yellow-200">
              <div className="text-xs text-yellow-700 flex items-center gap-4">
                <span>
                  📄 PDF Sources: {citations.filter(c => c.sourceType === 'pdf').length}
                </span>
                <span>
                  🌐 Web Sources: {citations.filter(c => c.sourceType === 'web').length}
                </span>
                <span>
                  📊 Avg. Relevance: {Math.round(citations.reduce((sum, c) => sum + c.score, 0) / citations.length * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* PDF Modal */}
      <PDFModal
        isOpen={pdfModal.isOpen}
        onClose={closePDFModal}
        filename={pdfModal.filename}
        page={pdfModal.page}
        citation={pdfModal.citation}
      />
    </div>
  );
}
