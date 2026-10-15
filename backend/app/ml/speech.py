"""Speaking metrics computed from a Whisper transcript with word timestamps."""
from __future__ import annotations

import re

SINGLE_FILLERS = {"um", "uh", "er", "ah", "erm", "hmm", "like", "so", "basically", "actually", "literally", "honestly", "right", "okay"}
MULTI_FILLERS = ("you know", "i mean", "kind of", "sort of")
PAUSE_THRESHOLD = 0.6  # seconds of silence between words that counts as a pause
IDEAL_WPM = (120, 160)


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z']+", text.lower())


def count_fillers(text: str) -> dict[str, int]:
    """Count filler words and phrases. "so"/"like" only count at clause starts
    or when surrounded by pauses-in-text (commas), to avoid flagging real usage."""
    lowered = " " + re.sub(r"\s+", " ", text.lower()) + " "
    counts: dict[str, int] = {}
    for phrase in MULTI_FILLERS:
        n = len(re.findall(rf"\b{phrase}\b", lowered))
        if n:
            counts[phrase] = n
            lowered = re.sub(rf"\b{phrase}\b", " ", lowered)
    for word in SINGLE_FILLERS:
        if word in ("like", "so", "right", "okay"):
            # Only clause-initial ("So, I...") or comma-marked ("and, like, ...")
            # uses count; "I like SQL" is not a filler.
            n = len(re.findall(rf"(?:^|[.,!?])\s*{word}\b|\b{word}(?=,)", lowered.strip()))
        else:
            n = len(re.findall(rf"\b{word}\b", lowered))
        if n:
            counts[word] = counts.get(word, 0) + n
    return dict(sorted(counts.items(), key=lambda kv: -kv[1]))


def compute_metrics(text: str, words: list[dict] | None = None, duration: float | None = None) -> dict:
    words = words or []
    tokens = _tokens(text)
    word_count = len(tokens)

    if words:
        start, end = words[0]["start"], words[-1]["end"]
        speaking_time = max(end - start, 0.1)
        gaps = [max(0.0, b["start"] - a["end"]) for a, b in zip(words, words[1:])]
    else:
        speaking_time = max(duration or word_count / 2.3, 0.1)
        gaps = []
    total = duration if duration else speaking_time

    wpm = word_count / (speaking_time / 60.0) if word_count else 0.0
    pauses = [g for g in gaps if g >= PAUSE_THRESHOLD]
    fillers = count_fillers(text)
    filler_total = sum(fillers.values())
    filler_rate = filler_total / word_count if word_count else 0.0

    # WPM over 5-second windows for the sparkline.
    series: list[float] = []
    if words:
        window = 5.0
        t, last = words[0]["start"], words[-1]["end"]
        while t < last:
            n = sum(1 for w in words if t <= w["start"] < t + window)
            series.append(round(n * 60 / window, 1))
            t += window

    # Clarity: start at 100 and subtract for fillers, pace and long pauses.
    clarity = 100.0
    clarity -= min(35.0, filler_rate * 100 * 3.5)
    lo, hi = IDEAL_WPM
    if wpm and wpm < lo:
        clarity -= min(25.0, (lo - wpm) * 0.5)
    elif wpm > hi:
        clarity -= min(25.0, (wpm - hi) * 0.5)
    clarity -= min(20.0, sum(1 for p in pauses if p > 2.0) * 5)
    if word_count < 15:
        clarity -= 20

    if not word_count:
        pace = "No speech"
    elif wpm < lo:
        pace = "A bit slow"
    elif wpm > hi:
        pace = "A bit fast"
    else:
        pace = "Good pace"

    return {
        "word_count": word_count,
        "duration": round(total, 2),
        "wpm": round(wpm, 1),
        "pace_label": pace,
        "filler_total": filler_total,
        "filler_rate": round(filler_rate, 4),
        "fillers": [{"word": w, "count": c} for w, c in fillers.items()],
        "pause_count": len(pauses),
        "longest_pause": round(max(gaps) if gaps else 0.0, 2),
        "clarity": round(max(0.0, min(100.0, clarity)), 1),
        "wpm_series": series,
    }
