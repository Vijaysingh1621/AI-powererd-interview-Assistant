"use client"

import { type CreateProjectKeyResponse, type LiveClient, LiveTranscriptionEvents, createClient } from "@deepgram/sdk"
import { useState, useEffect, useCallback, useRef } from "react"
import { useQueue } from "@uidotdev/usehooks"
import { MicIcon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Mic, MicOff, Monitor, Eye, EyeOff } from "lucide-react"
import { transcriptionManager } from "@/lib/transcriptionManager"

interface RecorderTranscriberProps {
  addTextinTranscription: (text: string, speaker?: "user" | "system" | "external") => void
}

export default function RecorderTranscriber({ addTextinTranscription }: RecorderTranscriberProps) {
  const isRendered = useRef(false)
  const { add, remove, first, size, queue } = useQueue<any>([])
  const [apiKey, setApiKey] = useState<CreateProjectKeyResponse | null>()
  const [connection, setConnection] = useState<LiveClient | null>()
  const [isListening, setListening] = useState(false)
  const [isLoadingKey, setLoadingKey] = useState(true)
  const [isLoading, setLoading] = useState(true)
  const [isProcessing, setProcessing] = useState(false)
  const [micOpen, setMicOpen] = useState(false)
  const [microphone, setRecorderTranscriber] = useState<MediaRecorder | null>()
  const [userMedia, setUserMedia] = useState<MediaStream | null>()
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>()
  const [systemAudioStream, setSystemAudioStream] = useState<MediaStream | null>()
  const [screenVideoStream, setScreenVideoStream] = useState<MediaStream | null>()
  const [isPreviewMinimized, setIsPreviewMinimized] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const [caption, setCaption] = useState<string | null>()
  const [lastFinalTranscript, setLastFinalTranscript] = useState<string>("")
  const [currentInterimTranscript, setCurrentInterimTranscript] = useState<string>("")
  const [currentAudioSource, setCurrentAudioSource] = useState<"microphone" | "system" | "mixed">("mixed")

  useEffect(() => {
    if (screenVideoStream && videoRef.current) {
      console.log("Setting video source:", screenVideoStream)
      setVideoLoaded(false)
      videoRef.current.srcObject = screenVideoStream
      videoRef.current.play().catch((error) => {
        console.error("Video play error in effect:", error)
        setVideoLoaded(false)
      })
    }
  }, [screenVideoStream])

  const toggleRecorderTranscriber = useCallback(async () => {
    if (microphone && (userMedia || microphoneStream)) {
      microphone.stop()
      setRecorderTranscriber(null)

      if (microphoneStream) {
        microphoneStream.getTracks().forEach((track) => track.stop())
        setMicrophoneStream(null)
      }
      if (systemAudioStream) {
        systemAudioStream.getTracks().forEach((track) => track.stop())
        setSystemAudioStream(null)
      }
      if (screenVideoStream) {
        screenVideoStream.getTracks().forEach((track) => track.stop())
        setScreenVideoStream(null)
      }
      if (userMedia) {
        userMedia.getTracks().forEach((track) => track.stop())
        setUserMedia(null)
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      setVideoLoaded(false)
    } else {
      try {
        const displayMedia = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: true,
        })

        const videoTracks = displayMedia.getVideoTracks()
        if (videoTracks.length > 0) {
          const videoStream = new MediaStream(videoTracks)
          setScreenVideoStream(videoStream)

          if (videoRef.current) {
            videoRef.current.srcObject = videoStream
            videoRef.current.play().catch((error) => {
              console.error("Video play error:", error)
            })
          }
        } else {
          setScreenVideoStream(displayMedia)
          if (videoRef.current) {
            videoRef.current.srcObject = displayMedia
            videoRef.current.play().catch((error) => {
              console.error("Fallback video play error:", error)
            })
          }
        }

        const audioOnlyStream = new MediaStream(displayMedia.getAudioTracks())
        setSystemAudioStream(audioOnlyStream)

        const hasSystemAudio = audioOnlyStream.getAudioTracks().length > 0

        if (hasSystemAudio) {
          setCurrentAudioSource("system")
          setUserMedia(audioOnlyStream)

          const mic = new MediaRecorder(audioOnlyStream)
          mic.start(500)

          mic.onstart = () => {
            setMicOpen(true)
          }

          mic.onstop = () => {
            setMicOpen(false)
            setLastFinalTranscript("")
            setCurrentInterimTranscript("")
            setCaption(null)
            transcriptionManager.reset()
          }

          mic.ondataavailable = (e) => {
            add(e.data)
          }

          setRecorderTranscriber(mic)
        } else {
          alert("No system audio detected. Please ensure your screen sharing includes audio.")
        }
      } catch (error) {
        console.error("Error accessing media devices:", error)
        alert("Please grant permission to access your microphone and screen audio.")
      }
    }
  }, [add, microphone, userMedia, microphoneStream, systemAudioStream, screenVideoStream])

  useEffect(() => {
    if (apiKey) return
    isRendered.current = true

    setApiKey({
      key: "99219f054eaf24d0d40c27ad48d6586c2333c45b",
      api_key_id: "main-key",
      scopes: ["usage:write"],
      created: new Date().toISOString(),
    } as CreateProjectKeyResponse)
    setLoadingKey(false)
  }, [apiKey])

  useEffect(() => {
    if (apiKey && "key" in apiKey) {
      const deepgram = createClient(apiKey?.key ?? "")
      const connection = deepgram.listen.live({
        model: "nova-2",
        interim_results: true,
        smart_format: true,
        punctuate: true,
        diarize: false,
        utterance_end_ms: 1000,
        vad_events: true,
        endpointing: 300,
      })

      connection.on(LiveTranscriptionEvents.Open, () => {
        setListening(true)
      })

      connection.on(LiveTranscriptionEvents.Close, () => {
        setListening(false)
        setApiKey(null)
        setConnection(null)
      })

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const words = data.channel.alternatives[0].words
        const caption = words.map((word: any) => word.punctuated_word ?? word.word).join(" ")

        if (caption && caption.trim().length > 0) {
          const isFinal = data.is_final

          setCaption(caption)

          const detectedSpeaker = "external"

          if (isFinal && transcriptionManager.shouldAddTranscript(caption, isFinal, detectedSpeaker)) {
            addTextinTranscription(caption, detectedSpeaker)
            setLastFinalTranscript(caption)
          } else if (!isFinal) {
            setCurrentInterimTranscript(caption)
          }
        }
      })

      setConnection(connection)
      setLoading(false)
    }
  }, [apiKey])

  useEffect(() => {
    const processQueue = async () => {
      if (size > 0 && !isProcessing) {
        setProcessing(true)

        if (isListening) {
          const blob = first
          connection?.send(blob)
          remove()
        }

        const waiting = setTimeout(() => {
          clearTimeout(waiting)
          setProcessing(false)
        }, 250)
      }
    }

    processQueue()
  }, [connection, queue, remove, first, size, isProcessing, isListening])

  if (isLoadingKey)
    return (
      <div className="w-full p-3 text-center text-sm bg-destructive text-destructive-foreground rounded-lg">
        Loading temporary API key...
      </div>
    )
  if (isLoading)
    return (
      <div className="w-full p-3 text-center text-sm bg-destructive text-destructive-foreground rounded-lg">
        Loading the app...
      </div>
    )

  return (
    <div className="w-full space-y-4">
      {/* Connection Button */}
      <div className="flex items-center justify-center">
        <Button
          onClick={toggleRecorderTranscriber}
          size="lg"
          className={cn(
            "w-20 h-20 rounded-full transition-all duration-200",
            micOpen
              ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              : "bg-primary hover:bg-primary/90 text-primary-foreground",
          )}
        >
          {micOpen ? <MicOff className="size-8" /> : <Mic className="size-8" />}
        </Button>
      </div>

      {/* Status */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          {micOpen ? (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Recording interviewer audio
              </span>
            </>
          ) : (
            <>
              <Monitor className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Click to start screen & audio capture</span>
            </>
          )}
        </div>
        {micOpen && (
          <Badge variant="secondary" className="text-xs">
            🎙️ Interviewer audio transcription active
          </Badge>
        )}
      </div>

      {/* Screen Preview */}
      {screenVideoStream && (
        <Card className="border-border/40 bg-gradient-to-b from-background to-muted/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Screen Share Preview</span>
                <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  ● Live
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPreviewMinimized(!isPreviewMinimized)}
                className="text-xs"
              >
                {isPreviewMinimized ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                {isPreviewMinimized ? "Show" : "Hide"}
              </Button>
            </div>

            {!isPreviewMinimized ? (
              <div className="space-y-3">
                <div className="relative">
                  <video
                    ref={videoRef}
                    className="w-full h-48 bg-black border border-border/40 object-contain rounded-lg"
                    muted
                    playsInline
                    autoPlay
                    controls={false}
                    onLoadedMetadata={() => setVideoLoaded(true)}
                    onError={() => setVideoLoaded(false)}
                  />
                  {!videoLoaded && screenVideoStream && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/75 text-white rounded-lg">
                      <div className="text-center">
                        <div className="animate-spin text-2xl mb-2">⏳</div>
                        <p className="text-sm">Loading screen preview...</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2 p-2 bg-muted/50 rounded-lg border border-border/40">
                  <Monitor className="size-4 text-blue-600" />
                  <span className="text-xs text-muted-foreground">
                    Capturing interviewer screen and audio for AI analysis
                  </span>
                  {videoLoaded && <Badge className="text-xs bg-green-100 text-green-800">✓ Video loaded</Badge>}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Monitor className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Preview minimized - Click "Show" to display screen sharing
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status Indicator */}
      <div className="fixed bottom-4 right-4 z-20">
        <div className="flex items-center gap-2 bg-background/95 backdrop-blur border border-border/40 rounded-full px-4 py-2 shadow-lg">
          <span
            className={cn("text-sm font-medium", {
              "text-green-600 dark:text-green-400": isListening,
              "text-muted-foreground": !isListening,
            })}
          >
            {isListening ? "🎙️ Connected" : "⏳ Connecting..."}
          </span>
          <MicIcon
            className={cn("h-4 w-4 transition-all duration-300", {
              "fill-green-500 animate-pulse": isListening,
              "fill-muted-foreground": !isListening,
            })}
          />
        </div>
      </div>
    </div>
  )
}
