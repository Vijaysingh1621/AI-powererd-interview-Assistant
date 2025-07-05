from google.cloud import speech
import os

class STTService:
    def __init__(self):
        self.client = speech.SpeechClient()

    async def transcribe_audio(self, audio_content: bytes):
        audio = speech.RecognitionAudio(content=audio_content)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=16000,
            language_code="en-US",
            enable_automatic_punctuation=True,
        )

        response = self.client.recognize(config=config, audio=audio)
        transcript = ""
        for result in response.results:
            transcript += result.alternatives[0].transcript

        return transcript