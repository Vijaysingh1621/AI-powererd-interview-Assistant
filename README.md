# Real-time Interview Transcription System

## Description

A modern, real-time interview transcription application built with Next.js that captures screen audio and provides live transcription using Deepgram's speech-to-text API. This system is designed for seamless interview recording and transcription with a clean, professional interface.

## 🚀 Features

### Core Functionality

- **Real-time Screen Audio Capture**: Uses browser's `getDisplayMedia` API to capture system audio from screen sharing
- **Live Transcription**: Integrates with Deepgram's real-time speech-to-text API for instant transcription
- **Single Audio Source**: Simplified architecture using only screen audio (no microphone complexity)
- **Professional UI**: Clean interview transcript interface with live screen sharing display
- **Connection Monitoring**: Real-time connection status and health monitoring for Deepgram

### Key Components

- **SimpleRecorder**: Modern React component for screen capture and audio transcription
- **Interview Transcript View**: Professional transcript display with timestamp and speaker identification
- **Live Screen Display**: Full-size video display of shared screen content
- **Connection Health**: Auto-reconnect functionality and connection status indicators

## 🏗️ Architecture

### Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **UI Framework**: Tailwind CSS, Radix UI components
- **Speech-to-Text**: Deepgram Real-time API
- **Audio Capture**: Browser Web APIs (getDisplayMedia, MediaRecorder)
- **State Management**: React hooks and context

### Simplified Design

The application has been streamlined to remove complex WASAPI dependencies and dual-channel audio processing. The new architecture focuses on:

1. **Single Screen Audio Source**: Captures audio directly from screen sharing
2. **Direct Deepgram Integration**: Real-time WebSocket connection to Deepgram
3. **Browser-native APIs**: Uses standard Web APIs for maximum compatibility
4. **Clean Component Structure**: Modular, maintainable React components

## 📦 Installation and Setup

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd final-ai-intervie
   ```

2. **Install dependencies**:

   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Environment Setup**:
   Create a `.env.local` file with your Deepgram API key:

   ```env
   NEXT_PUBLIC_DEEPGRAM_API_KEY=your_deepgram_api_key_here
   ```

4. **Run the development server**:

   ```bash
   npm run dev
   # or
   pnpm dev
   ```

5. **Open your browser** and navigate to `http://localhost:3000`

## 🎯 Usage

### Starting a Recording Session

1. Click "Connect & Share Screen" button
2. Select the tab, window, or entire screen you want to share
3. Ensure the selected source includes audio
4. The system will automatically connect to Deepgram and start transcription

### During Recording

- **Live Video**: See the shared screen in real-time
- **Live Transcript**: View transcription as it happens
- **Connection Status**: Monitor Deepgram connection health
- **Statistics**: Track message count and session uptime

### Stopping Recording

- Click "Stop Recording" to end the session
- All tracks will be stopped and connections closed cleanly

## 🔧 Configuration

### Deepgram Settings

The application uses optimized Deepgram configuration:

- **Model**: Nova-2 (latest high-accuracy model)
- **Language**: English (US)
- **Sample Rate**: 16kHz
- **Channels**: Mono (1 channel)
- **Features**: Punctuation, smart formatting, interim results

### Audio Capture Settings

- **Format**: WebM with Opus codec
- **Chunk Size**: 100ms for real-time processing
- **Audio Processing**: Disabled echo cancellation and noise suppression for cleaner capture

## 🛠️ Recent Changes

### Major Simplification (Latest Update)

- **Removed WASAPI Dependencies**: Eliminated complex Windows-specific audio capture
- **Single Audio Source**: Now uses only screen audio capture via browser APIs
- **Simplified Components**: Replaced complex dual-channel system with streamlined single-source recording
- **Enhanced UI**: Improved user experience with cleaner interface and better error handling
- **Browser Compatibility**: Works across all modern browsers without OS-specific dependencies

### Benefits of New Architecture

- **Easier Setup**: No complex audio driver requirements
- **Better Reliability**: Fewer moving parts, more stable connections
- **Cross-platform**: Works on Windows, Mac, and Linux
- **Simplified Debugging**: Clearer error messages and connection status

## 🔍 File Structure

```
components/
├── SimpleRecorder.tsx      # Main recording component
├── ChatTranscription.tsx   # Transcript display component
├── copilot.tsx            # Main application orchestrator
└── ui/                    # Reusable UI components

lib/
├── simpleDeepgramClient.ts # Simplified Deepgram client
├── transcriptionManager.ts # Transcript management utilities
└── utils.ts               # Utility functions

app/
├── page.tsx               # Main application page
├── layout.tsx             # Application layout
└── globals.css            # Global styles
```

## 🔒 Security & Privacy

- **Local Processing**: Audio is streamed directly to Deepgram without local storage
- **Secure Connections**: Uses WebSocket Secure (WSS) for Deepgram communication
- **No Persistent Data**: Transcripts are handled in memory during sessions
- **API Key Security**: Environment variables protect sensitive credentials

## 🆘 Support

For support and questions:

- Check the troubleshooting guide in `/docs`
- Review the debug console at `/debug`
- Ensure your Deepgram API key is properly configured
- Verify browser permissions for screen sharing and audio capture

## Contributing

Contributions are welcome! Please refer to the [CONTRIBUTING.md](https://github.com/innovatorved/realtime-interview-copilot/blob/main/CONTRIBUTING.md) file for guidelines.

## License

This project is licensed under the [License](https://github.com/innovatorved/realtime-interview-copilot/blob/main/LICENSE). See the LICENSE file for details.
