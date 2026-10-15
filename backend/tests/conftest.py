import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ["PRELOAD_WHISPER"] = "0"

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def pairs():
    read = lambda n: (FIXTURES / n).read_text()  # noqa: E731
    return {
        "strong": (read("strong_resume.txt"), read("strong_job.txt")),
        "weak": (read("weak_resume.txt"), read("weak_job.txt")),
    }


@pytest.fixture(autouse=True)
def no_gemini(monkeypatch):
    """Tests never call the real Gemini API."""
    from app import config

    monkeypatch.setattr(config, "GEMINI_API_KEY", "")
