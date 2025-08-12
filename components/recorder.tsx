"use client";

import {
  CreateProjectKeyResponse,
  LiveClient,
  LiveTranscriptionEvents,
  createClient,
} from "@deepgram/sdk";
import { useState, useEffect, useCallback, useRef } from "react";
import { useQueue } from "@uidotdev/usehooks";
import { MicIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MicOffIcon } from "lucide-react";
import { transcriptionManager } from "@/lib/transcriptionManager";

interface RecorderTranscriberProps {
  addTextinTranscription: (text: string, speaker?: 'user' | 'system' | 'external') => void;
}

export default function RecorderTranscriber({
  addTextinTranscription,
}: RecorderTranscriberProps) {
  const isRendered = useRef(false);
  const { add, remove, first, size, queue } = useQueue<any>([]);
  const [apiKey, setApiKey] = useState<CreateProjectKeyResponse | null>();
  const [connection, setConnection] = useState<LiveClient | null>();
  const [isListening, setListening] = useState(false);
  const [isLoadingKey, setLoadingKey] = useState(true);
  const [isLoading, setLoading] = useState(true);
  const [isProcessing, setProcessing] = useState(false);
  const [micOpen, setMicOpen] = useState(false);
  const [microphone, setRecorderTranscriber] = useState<MediaRecorder | null>();
  const [userMedia, setUserMedia] = useState<MediaStream | null>();
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>();
  const [systemAudioStream, setSystemAudioStream] = useState<MediaStream | null>();
  const [screenVideoStream, setScreenVideoStream] = useState<MediaStream | null>();
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isPreviewMinimized, setIsPreviewMinimized] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [caption, setCaption] = useState<string | null>();
  const [lastFinalTranscript, setLastFinalTranscript] = useState<string>("");
  const [currentInterimTranscript, setCurrentInterimTranscript] = useState<string>("");
  const [currentAudioSource, setCurrentAudioSource] = useState<'microphone' | 'system' | 'mixed'>('mixed');

  // Effect to handle video stream updates
  useEffect(() => {
    if (screenVideoStream && videoRef.current) {
      console.log("Setting video source:", screenVideoStream);
      setVideoLoaded(false); // Reset loading state
      videoRef.current.srcObject = screenVideoStream;
      videoRef.current.play().catch((error) => {
        console.error("Video play error in effect:", error);
        setVideoLoaded(false);
      });
    }
  }, [screenVideoStream]);

  const toggleRecorderTranscriber = useCallback(async () => {
    if (microphone && (userMedia || microphoneStream)) {
      // Stop all recording
      microphone.stop();
      setRecorderTranscriber(null);
      
      if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
        setMicrophoneStream(null);
      }
      if (systemAudioStream) {
        systemAudioStream.getTracks().forEach(track => track.stop());
        setSystemAudioStream(null);
      }
      if (screenVideoStream) {
        screenVideoStream.getTracks().forEach(track => track.stop());
        setScreenVideoStream(null);
      }
      if (userMedia) {
        userMedia.getTracks().forEach(track => track.stop());
        setUserMedia(null);
      }
      
      // Clear video preview
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setVideoLoaded(false);
    } else {
      try {
        // Get screen sharing with both video and audio
        const displayMedia = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: true,
        });

        console.log("Display media tracks:", displayMedia.getTracks());
        console.log("Video tracks:", displayMedia.getVideoTracks());
        console.log("Audio tracks:", displayMedia.getAudioTracks());

        // Extract video stream for preview
        const videoTracks = displayMedia.getVideoTracks();
        if (videoTracks.length > 0) {
          const videoStream = new MediaStream(videoTracks);
          setScreenVideoStream(videoStream);
          
          // Display video preview
          if (videoRef.current) {
            videoRef.current.srcObject = videoStream;
            console.log("Video element src set:", videoRef.current.srcObject);
            videoRef.current.play().catch((error) => {
              console.error("Video play error:", error);
            });
          }
        } else {
          console.warn("No video tracks available, trying original stream");
          // Fallback: use the original display media stream
          setScreenVideoStream(displayMedia);
          if (videoRef.current) {
            videoRef.current.srcObject = displayMedia;
            videoRef.current.play().catch((error) => {
              console.error("Fallback video play error:", error);
            });
          }
        }

        // Extract audio stream for transcription (interviewer only)
        const audioOnlyStream = new MediaStream(displayMedia.getAudioTracks());
        setSystemAudioStream(audioOnlyStream);

        // Use only system audio (interviewer) for transcription
        const hasSystemAudio = audioOnlyStream.getAudioTracks().length > 0;
        
        if (hasSystemAudio) {
          setCurrentAudioSource('system');
          setUserMedia(audioOnlyStream);

          // Start recording the system audio stream only
          const mic = new MediaRecorder(audioOnlyStream);
          mic.start(500);

          mic.onstart = () => {
            setMicOpen(true);
          };

          mic.onstop = () => {
            setMicOpen(false);
            // Reset transcript state when stopping
            setLastFinalTranscript("");
            setCurrentInterimTranscript("");
            setCaption(null);
            transcriptionManager.reset(); // Reset the transcription manager
          };

          mic.ondataavailable = (e) => {
            add(e.data);
          };

          setRecorderTranscriber(mic);
        } else {
          alert("No system audio detected. Please ensure your screen sharing includes audio.");
        }
      } catch (error) {
        console.error("Error accessing media devices:", error);
        alert("Please grant permission to access your microphone and screen audio.");
      }
    }
  }, [add, microphone, userMedia, microphoneStream, systemAudioStream, screenVideoStream]);

  useEffect(() => {
    console.log({ apiKey });
    if (apiKey) return;
    // if (isRendered.current) return;
    isRendered.current = true;
    console.log("using main api key");
    
    // Use the main API key directly instead of creating temporary keys
    setApiKey({ 
      key: "99219f054eaf24d0d40c27ad48d6586c2333c45b",
      api_key_id: "main-key",
      scopes: ["usage:write"],
      created: new Date().toISOString()
    } as CreateProjectKeyResponse);
    setLoadingKey(false);
  }, [apiKey]);

  useEffect(() => {
    if (apiKey && "key" in apiKey) {
      console.log("connecting to deepgram");
      const deepgram = createClient(apiKey?.key ?? "");
      const connection = deepgram.listen.live({
        model: "nova-2",
        interim_results: true,
        smart_format: true,
        punctuate: true,
        diarize: false, // Disable speaker diarization to reduce processing
        utterance_end_ms: 1000, // Wait 1 second of silence before finalizing
        vad_events: true, // Voice activity detection
        endpointing: 300, // Shorter endpointing for faster results
      });

      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log("connection established");
        setListening(true);
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        console.log("connection closed");
        setListening(false);
        setApiKey(null);
        setConnection(null);
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const words = data.channel.alternatives[0].words;
        const caption = words
          .map((word: any) => word.punctuated_word ?? word.word)
          .join(" ");
        
        if (caption && caption.trim().length > 0) {
          const isFinal = data.is_final;
          
          // Always update the display caption for user feedback
          setCaption(caption);
          
          // Always mark as 'external' (interviewer) since we're only capturing system audio
          const detectedSpeaker = 'external';
          
          // Only add final transcripts to prevent duplicates
          if (isFinal && transcriptionManager.shouldAddTranscript(caption, isFinal, detectedSpeaker)) {
            console.log("Adding final transcript (Interviewer):", caption);
            addTextinTranscription(caption, detectedSpeaker);
            setLastFinalTranscript(caption);
          } else if (!isFinal) {
            // Update interim display
            setCurrentInterimTranscript(caption);
            console.log("Interim transcript (Interviewer):", caption);
          }
        }
      });

      setConnection(connection);
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    const processQueue = async () => {
      if (size > 0 && !isProcessing) {
        setProcessing(true);

        if (isListening) {
          const blob = first;
          connection?.send(blob);
          remove();
        }

        const waiting = setTimeout(() => {
          clearTimeout(waiting);
          setProcessing(false);
        }, 250);
      }
    };

    processQueue();
  }, [connection, queue, remove, first, size, isProcessing, isListening]);

  if (isLoadingKey)
    return (
      <span className="w-full p-2 text-center text-xs bg-red-500 text-white">
        Loading temporary API key...
      </span>
    );
  if (isLoading)
    return (
      <span className="w-full p-2 text-center text-xs bg-red-500 text-white">
        Loading the app...
      </span>
    );

  return (
    <div className="w-full relative">
      <div className="grid mt-2 align-middle items-center gap-2">
        <Button
          className="h-9 bg-green-600 hover:bg-green-800 text-white"
          size="sm"
          variant="outline"
          onClick={() => toggleRecorderTranscriber()}
        >
          {!micOpen ? (
            <div className="flex items-center">
              <MicIcon className="h-4 w-4 -translate-x-0.5 mr-2" />
              Connect
            </div>
          ) : (
            <div className="flex items-center">
              <MicOffIcon className="h-4 w-4 -translate-x-0.5 mr-2" />
              Disconnect
            </div>
          )}
        </Button>
        {micOpen && (
          <div className="text-xs text-gray-600 mt-1">
            🎙️ Interviewer audio transcription active
          </div>
        )}
        
        {/* Screen Sharing Preview */}
        {screenVideoStream && (
          <div className="mt-4 p-4 border border-gray-300 bg-gray-50 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Screen Share Preview
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-700 bg-green-100 px-3 py-1 font-medium border border-green-200">
                  ● Live
                </span>
                <button
                  onClick={() => setIsPreviewMinimized(!isPreviewMinimized)}
                  className="text-xs text-gray-600 hover:text-gray-800 px-3 py-1 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                >
                  {isPreviewMinimized ? "Show" : "Hide"}
                </button>
              </div>
            </div>
            {!isPreviewMinimized && (
              <>
                <div className="relative">
                  <video
                    ref={videoRef}
                    className="w-full h-64 bg-black border-2 border-gray-200 object-contain shadow-inner"
                    muted
                    playsInline
                    autoPlay
                    controls={false}
                    onLoadedMetadata={() => {
                      console.log("Video metadata loaded");
                      setVideoLoaded(true);
                    }}
                    onError={(e) => {
                      console.error("Video error:", e);
                      setVideoLoaded(false);
                    }}
                    onCanPlay={() => console.log("Video can play")}
                  />
                  {!videoLoaded && screenVideoStream && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 text-white border-2 border-gray-200">
                      <div className="text-center">
                        <div className="animate-spin text-2xl mb-2">⏳</div>
                        <p className="text-sm">Loading screen preview...</p>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-3 text-center bg-white px-3 py-2 border">
                   Capturing interviewer screen and audio for AI analysis
                  {videoLoaded && <span className="text-green-600 ml-2">✓ Video loaded</span>}
                </p>
              </>
            )}
            {isPreviewMinimized && (
              <div className="text-center py-6">
                <div className="text-2xl mb-2">📱</div>
                <p className="text-xs text-gray-600">
                  Preview minimized - Click &ldquo;Show&rdquo; to display screen sharing
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <div
        className="z-20 text-white flex shrink-0 grow-0 justify-around items-center 
                  fixed bottom-0 right-5 rounded-xl mr-1 mb-5 lg:mr-5 lg:mb-5 xl:mr-10 xl:mb-10 gap-3 
                  bg-gray-800 px-4 py-2 shadow-lg border border-gray-700"
      >
        <span className={cn("text-sm font-medium", {
          "text-green-400": isListening,
          "text-gray-400": !isListening
        })}>
          {isListening
            ? "🎙️ Interviewer Connected"
            : "⏳ Connecting..."}
        </span>
        <MicIcon
          className={cn("h-4 w-4 transition-all duration-300", {
            "fill-green-400 drop-shadow-glowBlue animate-pulse": isListening,
            "fill-gray-400": !isListening,
          })}
        />
      </div>
    </div>
  );
}
