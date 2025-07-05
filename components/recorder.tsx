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
  const videoRef = useRef<HTMLVideoElement>(null);

  const [caption, setCaption] = useState<string | null>();
  const [lastFinalTranscript, setLastFinalTranscript] = useState<string>("");
  const [currentInterimTranscript, setCurrentInterimTranscript] = useState<string>("");
  const [currentAudioSource, setCurrentAudioSource] = useState<'microphone' | 'system' | 'mixed'>('mixed');

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

        // Extract video stream for preview
        const videoStream = new MediaStream(displayMedia.getVideoTracks());
        setScreenVideoStream(videoStream);
        
        // Display video preview
        if (videoRef.current) {
          videoRef.current.srcObject = videoStream;
          videoRef.current.play().catch(console.error);
        }

        // Extract audio stream for transcription
        const audioOnlyStream = new MediaStream(displayMedia.getAudioTracks());
        setSystemAudioStream(audioOnlyStream);

        // Get microphone audio (your voice)
        let micMedia = null;
        try {
          micMedia = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          setMicrophoneStream(micMedia);
          setIsMicEnabled(true);
        } catch (micError) {
          console.warn("Microphone access denied or not available:", micError);
          setIsMicEnabled(false);
        }

        // Combine both audio streams for transcription
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        
        // Track if we have both sources
        const hasSystemAudio = audioOnlyStream.getAudioTracks().length > 0;
        const hasMicAudio = micMedia !== null;
        
        // Determine audio source type
        if (hasSystemAudio && hasMicAudio) {
          setCurrentAudioSource('mixed');
        } else if (hasSystemAudio) {
          setCurrentAudioSource('system');
        } else if (hasMicAudio) {
          setCurrentAudioSource('microphone');
        }
        
        // Add system audio
        if (hasSystemAudio) {
          const systemSource = audioContext.createMediaStreamSource(audioOnlyStream);
          const systemGain = audioContext.createGain();
          systemGain.gain.value = 0.8; // Slightly reduce system audio to prevent feedback
          systemSource.connect(systemGain);
          systemGain.connect(destination);
        }

        // Add microphone audio if available
        if (micMedia) {
          const micSource = audioContext.createMediaStreamSource(micMedia);
          const micGain = audioContext.createGain();
          micGain.gain.value = 1.0; // Full volume for microphone
          micSource.connect(micGain);
          micGain.connect(destination);
        }

        const combinedStream = destination.stream;
        setUserMedia(combinedStream);

        // Start recording the combined audio stream
        const mic = new MediaRecorder(combinedStream);
        mic.start(500);

        mic.onstart = () => {
          setMicOpen(true);
        };

        mic.onstop = () => {
          setMicOpen(false);
          audioContext.close();
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
          
          // Determine speaker based on audio source and content analysis
          const detectedSpeaker = transcriptionManager.detectSpeaker(currentAudioSource, caption);
          
          // Only add final transcripts to prevent duplicates
          if (isFinal && transcriptionManager.shouldAddTranscript(caption, isFinal, detectedSpeaker)) {
            console.log("Adding final transcript:", caption, "Speaker:", detectedSpeaker);
            addTextinTranscription(caption, detectedSpeaker);
            setLastFinalTranscript(caption);
          } else if (!isFinal) {
            // Update interim display
            setCurrentInterimTranscript(caption);
            console.log("Interim transcript:", caption);
          }
        }
      });

      setConnection(connection);
      setLoading(false);
    }
  }, [apiKey, addTextinTranscription, currentAudioSource]);

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
            {isMicEnabled ? "✓ Me + Interviewer" : "⚠ Interviewer only (mic access denied)"}
          </div>
        )}
        
        {/* Screen Sharing Preview */}
        {screenVideoStream && (
          <div className="mt-4 p-4 border border-gray-300 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Screen Share Preview
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-700 bg-green-100 px-3 py-1 rounded-full font-medium border border-green-200">
                  ● Live
                </span>
                <button
                  onClick={() => setIsPreviewMinimized(!isPreviewMinimized)}
                  className="text-xs text-gray-600 hover:text-gray-800 px-3 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                >
                  {isPreviewMinimized ? "Show" : "Hide"}
                </button>
              </div>
            </div>
            {!isPreviewMinimized && (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-40 bg-black rounded-lg border-2 border-gray-200 object-contain shadow-inner"
                  muted
                  playsInline
                  autoPlay
                />
                <p className="text-xs text-gray-600 mt-3 text-center bg-white px-3 py-2 rounded-md border">
                  📺 Capturing screen content and audio for AI analysis
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
                  bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-2 shadow-lg border border-gray-700"
      >
        <span className={cn("text-sm font-medium", {
          "text-green-400": isListening,
          "text-gray-400": !isListening
        })}>
          {isListening
            ? "🟢 Connected to AI"
            : "🟡 Connecting..."}
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
