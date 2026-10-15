"""Runtime configuration loaded from environment / .env."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

# Keep downloaded TF-Hub models inside the project so they survive reboots
# (the default /tmp cache is wiped by macOS).
os.environ.setdefault("TFHUB_CACHE_DIR", str(BACKEND_DIR / ".cache" / "tfhub"))
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"

USE_MODELS: dict[str, str] = {
    "use-v4": "https://tfhub.dev/google/universal-sentence-encoder/4",
    "use-large-v5": "https://tfhub.dev/google/universal-sentence-encoder-large/5",
}
DEFAULT_USE_MODEL = "use-v4"

WHISPER_DEFAULT_SIZE: str = os.getenv("WHISPER_MODEL", "base")
WHISPER_CACHE_DIR: str = os.getenv("WHISPER_CACHE_DIR", str(BACKEND_DIR / ".cache" / "whisper"))
PRELOAD_WHISPER: bool = os.getenv("PRELOAD_WHISPER", "1") not in ("0", "false", "False")
