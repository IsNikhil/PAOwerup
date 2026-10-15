"""OpenAI Whisper transcription (runs locally on CPU, needs FFmpeg)."""
from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
import threading
import time
from pathlib import Path

from app import config

log = logging.getLogger(__name__)

SIZES = ("tiny", "base", "small")


class WhisperService:
    def __init__(self) -> None:
        self._models: dict[str, object] = {}
        self._lock = threading.Lock()
        self.status = "idle"
        self.detail = "Loads on first use"
        if not shutil.which("ffmpeg"):
            self.status, self.detail = "error", "FFmpeg not found on PATH"

    def load(self, size: str = config.WHISPER_DEFAULT_SIZE):
        size = size if size in SIZES else "base"
        with self._lock:
            if size in self._models:
                return self._models[size]
            import whisper

            self.status, self.detail = "loading", f"Loading Whisper {size}"
            t0 = time.perf_counter()
            try:
                model = whisper.load_model(size, device="cpu", download_root=config.WHISPER_CACHE_DIR)
            except Exception as exc:
                self.status, self.detail = "error", f"{type(exc).__name__}: {exc}"
                raise
            self._models[size] = model
            self.status = "ready"
            self.detail = f"Whisper {', '.join(self._models)} ready ({time.perf_counter() - t0:.1f}s)"
            return model

    def transcribe(self, audio_bytes: bytes, filename: str = "audio.webm", size: str = "base") -> dict:
        if not shutil.which("ffmpeg"):
            raise RuntimeError("FFmpeg is not installed. Install it (brew install ffmpeg / winget install ffmpeg) and restart.")
        model = self.load(size)
        t0 = time.perf_counter()
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / (Path(filename).name or "audio.webm")
            src.write_bytes(audio_bytes)
            wav = Path(tmp) / "audio.wav"
            # Browser recordings are webm/opus; convert to 16 kHz mono WAV.
            proc = subprocess.run(
                ["ffmpeg", "-nostdin", "-y", "-i", str(src), "-ac", "1", "-ar", "16000", str(wav)],
                capture_output=True,
            )
            if proc.returncode != 0:
                raise RuntimeError("FFmpeg could not decode the audio: " + proc.stderr.decode(errors="ignore")[-300:])
            result = model.transcribe(str(wav), fp16=False, word_timestamps=True, language="en")  # type: ignore[attr-defined]
            import whisper

            duration = float(len(whisper.load_audio(str(wav))) / whisper.audio.SAMPLE_RATE)

        words = [
            {"word": w["word"].strip(), "start": round(float(w["start"]), 2), "end": round(float(w["end"]), 2)}
            for seg in result.get("segments", [])
            for w in seg.get("words", [])
        ]
        return {
            "text": result.get("text", "").strip(),
            "words": words,
            "duration": round(duration, 2),
            "language": result.get("language", "en"),
            "model": size,
            "elapsed_ms": round((time.perf_counter() - t0) * 1000, 1),
        }


whisper_service = WhisperService()
