"""Local Whisper STT service boundary."""


class SpeechToTextService:
    def transcribe(self, audio_path: str) -> str:
        raise NotImplementedError
