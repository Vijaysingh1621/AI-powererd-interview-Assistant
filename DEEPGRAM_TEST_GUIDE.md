# Deepgram Integration Test Guide

## Overview

The AI Interview Assistant now uses Deepgram for single-source transcription, focusing on capturing **interviewer audio only** through screen sharing.

## Key Features

### 🎙️ Interviewer-Only Transcription

- **Audio Source**: System audio from screen sharing (interviewer)
- **Speaker Detection**: All transcriptions are automatically labeled as "Interviewer"
- **No Microphone**: User's microphone is not used for transcription
- **Real-time**: Live transcription using Deepgram Nova-2 model

### 📺 Enhanced Screen Sharing

- **Bigger Preview**: Increased video preview size (h-64 instead of h-40)
- **Better Visibility**: Blue-themed styling with prominent borders
- **Live Status**: Clear indication of recording status
- **Enhanced Layout**: Takes up 2/3 of the grid space for better visibility

## How to Test

### 1. Start Screen Sharing

1. Click the "Connect" button
2. Select the screen/window you want to share
3. **Important**: Make sure to check "Share audio" in the browser dialog
4. You should see:
   - Large blue screen sharing preview box
   - "LIVE RECORDING" status indicator
   - "Interviewer audio transcription active" message

### 2. Test Transcription

1. Play audio from the shared screen (YouTube video, meeting, etc.)
2. Watch the real-time transcription appear in the chat
3. All messages should be labeled as "Interviewer" (left side)
4. Final transcripts will be processed by the AI system

### 3. Verify Audio Source

- Only system audio from screen sharing is captured
- No microphone input is used
- Status indicator shows "🎙️ Interviewer Connected"

## Configuration

### Deepgram Settings

```typescript
model: "nova-2";
interim_results: true;
smart_format: true;
punctuate: true;
diarize: false; // Disabled since we only have one speaker
utterance_end_ms: 1000;
vad_events: true;
endpointing: 300;
```

### Audio Processing

- **Source**: Screen sharing system audio only
- **Format**: MediaRecorder chunks sent to Deepgram
- **Speaker**: Always marked as 'external' (Interviewer)
- **Quality**: Direct system audio capture without mixing

## Troubleshooting

### No Audio Transcription

1. Ensure screen sharing includes audio
2. Check browser permissions for screen sharing
3. Verify the shared application is producing audio
4. Look for "Interviewer audio transcription active" status

### Screen Preview Not Showing

1. Grant screen sharing permissions
2. Refresh the page and try again
3. Check browser console for errors

### Poor Transcription Quality

1. Ensure clear audio from the shared source
2. Avoid background noise in the shared audio
3. Use applications with clear speech (not music/noise)

## API Configuration

The system uses a hardcoded Deepgram API key for testing:

```typescript
key: "99219f054eaf24d0d40c27ad48d6586c2333c45b";
```

For production, replace this with environment variable configuration.

## Layout Changes

### Grid Layout

- **Left Column (2/3)**: Screen sharing and PDF manager
- **Right Column (1/3)**: Transcription display and controls
- **Enhanced Styling**: Removed gradients, bigger screen preview

### Visual Improvements

- Blue color scheme for screen sharing components
- Larger video preview (264px height)
- Prominent "LIVE RECORDING" indicator
- Clear status messages for audio capture

## Expected Behavior

1. **Connection**: Blue status indicator shows "🎙️ Interviewer Connected"
2. **Screen Sharing**: Large, prominent video preview with blue borders
3. **Transcription**: Real-time text appears labeled as "Interviewer"
4. **AI Processing**: Extracted questions and responses work normally
5. **Citations**: PDF and web search function as before

The system now provides a focused, single-source transcription experience optimized for interview scenarios where you need to capture the interviewer's audio through screen sharing.
