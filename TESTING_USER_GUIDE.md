# 🎤 WASAPI + Deepgram Testing Guide

## Quick Start Testing

### 1. Launch the Application
```bash
npm run dev
```
Wait for "Ready in X.Xs" message, then navigate to http://localhost:3000

### 2. Test Environment (Recommended First)
Visit: http://localhost:3000/debug

1. Click **"Run Environment Test"**
2. Grant microphone permissions when prompted
3. Verify all tests show **"Pass"** status:
   - ✅ Browser Env
   - ✅ Media API  
   - ✅ Env Vars
   - ✅ Mic Access
   - ✅ Deepgram Connection

### 3. Test Real-time Transcription

#### Using Debug Page:
1. Scroll to "WASAPI Recorder Test" section
2. Click **"Start Recording"** button
3. Speak clearly into microphone
4. Watch real-time transcription appear in Debug Logs

#### Using Main App:
1. Navigate to http://localhost:3000
2. Find the WASAPI Recorder component
3. Click recording button
4. Speak and observe transcription

## Expected Behavior

### Successful Start
```
🎯 DualChannelDeepgramClient created
🔑 Initializing Deepgram API key...
✅ Deepgram API key initialized
🔌 Connecting to Deepgram dual-channel...
✅ Dual-channel Deepgram connection established
🎤 Starting dual-channel transcription...
```

### Real-time Transcription
```
📝 Transcription [me]: Hello, this is a test
📝 Transcription [interviewer]: How are you doing today?
🔄 Transcription update: {"text": "Great!", "speaker": "me", "confidence": 0.95}
```

## Troubleshooting

### Common Issues & Solutions

#### ❌ "Microphone permission denied"
**Solution**: 
- Click browser's microphone icon
- Select "Allow" for microphone access
- Refresh page and try again

#### ❌ "NEXT_PUBLIC_DEEPGRAM_API_KEY not found"
**Solution**:
- Check `.env` file exists in project root
- Verify `NEXT_PUBLIC_DEEPGRAM_API_KEY` is set
- Restart development server

#### ❌ "Deepgram WebSocket connection failed"
**Solution**:
- Check internet connection
- Verify Deepgram API key is valid
- Try refreshing the page

#### ❌ "MediaDevices API not available"
**Solution**:
- Use HTTPS or localhost (required for microphone access)
- Try Chrome/Edge instead of older browsers
- Check if browser supports WebRTC

### Debug Logs Location
- **Browser Console**: F12 → Console tab
- **Debug Page**: http://localhost:3000/debug → Debug Logs section
- **Server Logs**: Terminal running `npm run dev`

## Testing Scenarios

### 1. Basic Functionality
- [ ] Environment test passes
- [ ] Recording starts without errors
- [ ] Speech is transcribed in real-time
- [ ] Recording stops cleanly

### 2. Dual-Channel Support
- [ ] External microphone transcription works
- [ ] System audio detection (if available)
- [ ] Proper speaker identification (me/interviewer)

### 3. Error Recovery
- [ ] Recovers from temporary network issues
- [ ] Handles microphone permission changes
- [ ] Graceful handling of API rate limits

### 4. Performance
- [ ] Low latency (< 1 second for transcription)
- [ ] No memory leaks during extended use
- [ ] Stable connection for 5+ minutes

## Success Criteria

✅ **PASS**: All environment tests pass  
✅ **PASS**: Recording starts without errors  
✅ **PASS**: Real-time transcription appears  
✅ **PASS**: No console errors during normal operation  
✅ **PASS**: System works for extended periods  

## Need Help?

1. **Check Debug Logs**: Most issues show detailed error messages
2. **Browser DevTools**: F12 → Console for client-side errors  
3. **Server Logs**: Terminal output for server-side issues
4. **Restart**: Try restarting the dev server if issues persist

---

🎉 **Happy Testing!** The system is designed to work reliably across modern browsers with proper permissions.
