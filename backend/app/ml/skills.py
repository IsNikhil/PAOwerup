"""Skill extraction from free text using the built-in taxonomy.

The taxonomy (``app/data/skills.json``) lists ~300 skills, each with a
canonical name, a category, aliases (``"js" -> "JavaScript"``) and a short
"how to learn it" hint.  Extraction is plain phrase matching with careful
word boundaries, so it is fast, deterministic and easy to unit-test.  The
TensorFlow matcher later decides *semantically* whether a job skill is covered
by the resume; this module only decides which skills are *mentioned*.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

TAXONOMY_PATH = Path(__file__).resolve().parent.parent / "data" / "skills.json"

# Names that are ordinary English words or single letters. These only match
# with their exact capitalisation (``Go`` the language, not "go to market").
CASE_SENSITIVE = {"C", "R", "Go", "Swift", "Rust", "Ruby", "Spark", "Unity", "Lua", "Julia", "Dart", "Excel", "SAS", "Kanban", "Flask"}

# Words that signal how important a job-description sentence is.
REQUIRED_CUES = re.compile(r"\b(required|must|need|needs|essential|minimum|proficien\w*|strong|expert|experience (with|in))\b", re.I)
PREFERRED_CUES = re.compile(r"\b(preferred|nice to have|bonus|plus|familiarity|exposure|desirable)\b", re.I)


@dataclass(frozen=True)
class Skill:
    name: str
    category: str
    aliases: tuple[str, ...]
    hint: str
    match_name: bool = True  # False for generic words ("Sales") matched only via aliases


@dataclass
class SkillMention:
    name: str
    category: str
    count: int
    sentences: list[str]


@lru_cache(maxsize=1)
def load_taxonomy() -> tuple[Skill, ...]:
    raw = json.loads(TAXONOMY_PATH.read_text())
    return tuple(
        Skill(s["name"], s["category"], tuple(s.get("aliases", [])), s.get("hint", ""), s.get("match_name", True))
        for s in raw
    )


@lru_cache(maxsize=1)
def taxonomy_index() -> dict[str, Skill]:
    return {s.name.lower(): s for s in load_taxonomy()}


def get_skill(name: str) -> Skill | None:
    return taxonomy_index().get(name.lower())


def hint_for(name: str) -> str:
    skill = get_skill(name)
    if skill:
        return skill.hint
    return f"Complete a short project that uses {name} and add it to your resume with a measurable result."


def _phrase_pattern(phrase: str) -> str:
    # Boundaries that work for symbols too (C++, C#, .NET, Node.js).
    escaped = re.escape(phrase).replace(r"\ ", r"[\s\-]+")
    return rf"(?<![\w+#./-]){escaped}(?![\w+#]|-(?=\w)|&)"


@lru_cache(maxsize=1)
def _compiled() -> list[tuple[Skill, re.Pattern[str]]]:
    out: list[tuple[Skill, re.Pattern[str]]] = []
    for skill in load_taxonomy():
        sensitive_terms: list[str] = []
        insensitive_terms: list[str] = []
        terms = (skill.name, *skill.aliases) if skill.match_name else skill.aliases
        for term in terms:
            is_acronym = term.isupper() and len(term) <= 4
            if term in CASE_SENSITIVE or len(term) <= 1 or is_acronym:
                sensitive_terms.append(_phrase_pattern(term))
            else:
                insensitive_terms.append(_phrase_pattern(term))
        parts: list[str] = []
        if insensitive_terms:
            parts.append("(?i:" + "|".join(sorted(insensitive_terms, key=len, reverse=True)) + ")")
        if sensitive_terms:
            parts.append("(?:" + "|".join(sorted(sensitive_terms, key=len, reverse=True)) + ")")
        out.append((skill, re.compile("|".join(parts))))
    return out


@lru_cache(maxsize=1)
def _patterns_by_name() -> dict[str, re.Pattern[str]]:
    return {sk.name: p for sk, p in _compiled()}


_SENT_SPLIT = re.compile(r"(?<=[.!?;])\s+(?=[A-Z0-9•\-])|\n+")
_BULLET = re.compile(r"^\s*([•●▪◦‣∙·\-*–—>]|\d+[.)])\s*")


def split_sentences(text: str, min_words: int = 3, max_sentences: int = 250) -> list[str]:
    """Split resume/JD text into clean sentences and bullet points."""
    seen: set[str] = set()
    out: list[str] = []
    for chunk in _SENT_SPLIT.split(text or ""):
        s = _BULLET.sub("", chunk).strip(" \t|•")
        s = re.sub(r"\s+", " ", s)
        if len(s.split()) < min_words:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s[:600])
        if len(out) >= max_sentences:
            break
    return out


def extract_skills(text: str) -> list[SkillMention]:
    """Return taxonomy skills mentioned in ``text`` with counts, most frequent first."""
    if not text:
        return []
    sentences = [s for s in re.split(r"\n+|(?<=[.!?;])\s+", text) if s.strip()]
    spans: list[tuple[int, int, Skill]] = []
    for skill, pattern in _compiled():
        spans.extend((m.start(), m.end(), skill) for m in pattern.finditer(text) if m.end() > m.start())

    # Drop a hit that sits strictly inside a longer hit of another skill,
    # e.g. "BI" inside "Power BI" or "React" inside "React Native".
    kept = [
        (a, b, sk) for a, b, sk in spans
        if not any(sk2 is not sk and a2 <= a and b <= b2 and (b2 - a2) > (b - a) for a2, b2, sk2 in spans)
    ]

    found: dict[str, SkillMention] = {}
    for _a, _b, skill in kept:
        if skill.name in found:
            found[skill.name].count += 1
            continue
        pattern = _patterns_by_name()[skill.name]
        hits = [s.strip() for s in sentences if pattern.search(s)]
        found[skill.name] = SkillMention(skill.name, skill.category, 1, hits[:5])
    return sorted(found.values(), key=lambda m: (-m.count, m.name))


def skill_importance(mention: SkillMention, job_title: str = "") -> float:
    """Heuristic 0-1 importance of a job skill: frequency, cue words, title."""
    score = 0.35 + min(mention.count, 4) * 0.12
    joined = " ".join(mention.sentences)
    if REQUIRED_CUES.search(joined):
        score += 0.2
    if PREFERRED_CUES.search(joined) and not REQUIRED_CUES.search(joined):
        score -= 0.2
    if job_title and mention.name.lower() in job_title.lower():
        score += 0.2
    return round(max(0.05, min(score, 1.0)), 2)


def importance_label(value: float) -> str:
    return "high" if value >= 0.7 else "medium" if value >= 0.45 else "low"
