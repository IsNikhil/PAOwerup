"""Pydantic request/response models shared by every router."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------- health


class ModelStatus(BaseModel):
    status: Literal["idle", "loading", "ready", "error", "disabled"]
    detail: str = ""


class HealthResponse(BaseModel):
    ok: bool = True
    use: ModelStatus
    whisper: ModelStatus
    gemini: ModelStatus
    gemini_model: str
    tensorflow_version: str


# ---------------------------------------------------------------- documents


class ParseResumeResponse(BaseModel):
    filename: str
    text: str
    chars: int
    words: int


# ---------------------------------------------------------------- skills


class SkillHit(BaseModel):
    name: str
    category: str
    count: int = 1
    source: Literal["taxonomy", "gemini"] = "taxonomy"


class SkillsRequest(BaseModel):
    resume_text: str
    job_text: str
    source: Literal["taxonomy", "taxonomy+gemini"] = "taxonomy"


class SkillsResponse(BaseModel):
    resume: list[SkillHit]
    job: list[SkillHit]
    gemini_used: bool = False
    note: str = ""


# ---------------------------------------------------------------- match


class MatchRequest(BaseModel):
    resume_text: str
    job_text: str
    model: Literal["use-v4", "use-large-v5"] = "use-v4"
    threshold: float = Field(0.50, ge=0.0, le=1.0)
    top_k: int = Field(3, ge=1, le=10)
    resume_skills: list[str] | None = None
    job_skills: list[str] | None = None


class Evidence(BaseModel):
    sentence: str
    similarity: float


class MatchedSkill(BaseModel):
    name: str
    similarity: float
    match_type: Literal["exact", "semantic"]
    matched_with: str
    evidence: list[Evidence]
    hint: str = ""


class MissingSkill(BaseModel):
    name: str
    similarity: float
    importance: float
    importance_label: Literal["high", "medium", "low"]
    closest: str = ""
    hint: str = ""


class Breakdown(BaseModel):
    skill_coverage: float
    sentence_similarity: float
    document_similarity: float
    raw_document_cosine: float
    raw_sentence_mean: float


class MatchResponse(BaseModel):
    score: float
    verdict: Literal["Strong match", "Good match", "Fair match", "Weak match"]
    summary: str
    breakdown: Breakdown
    weights: dict[str, float]
    matched_skills: list[MatchedSkill]
    missing_skills: list[MissingSkill]
    model: str
    threshold: float
    elapsed_ms: float
    resume_sentences: int
    job_sentences: int


# ---------------------------------------------------------------- gemini: rewrite


class ResumeItem(BaseModel):
    heading: str = ""
    subheading: str = ""
    dates: str = ""
    bullets: list[str] = []


class ResumeSection(BaseModel):
    title: str
    items: list[ResumeItem]


class ResumeDoc(BaseModel):
    name: str = ""
    headline: str = ""
    contact: str = ""
    summary: str = ""
    sections: list[ResumeSection] = []
    skills: list[str] = []
    skills_to_develop: list[str] = []
    changes: list[str] = []


class RewriteRequest(BaseModel):
    resume_text: str
    job_text: str
    job_title: str = ""
    matched_skills: list[str] = []
    missing_skills: list[str] = []
    tone: Literal["Professional", "Concise", "Bold"] = "Professional"
    instructions: str = ""


class RewriteResponse(BaseModel):
    resume: ResumeDoc
    source: Literal["gemini", "fallback"]
    note: str = ""


# ---------------------------------------------------------------- gemini: coach


class CoachStep(BaseModel):
    title: str
    detail: str
    timeframe: str = ""


class CoachRequest(BaseModel):
    job_title: str = ""
    job_text: str = ""
    score: float = 0
    verdict: str = ""
    matched_skills: list[str] = []
    missing_skills: list[str] = []
    instructions: str = ""


class CoachResponse(BaseModel):
    headline: str
    steps: list[CoachStep]
    source: Literal["gemini", "fallback"]
    note: str = ""


# ---------------------------------------------------------------- interview


class QuestionsRequest(BaseModel):
    job_text: str = ""
    job_title: str = ""
    missing_skills: list[str] = []


class QuestionsResponse(BaseModel):
    questions: list[str]
    source: Literal["gemini", "fallback"]


class Word(BaseModel):
    word: str
    start: float
    end: float


class TranscriptResponse(BaseModel):
    text: str
    words: list[Word]
    duration: float
    language: str = "en"
    model: str
    elapsed_ms: float


class SpeechMetricsRequest(BaseModel):
    text: str
    words: list[Word] = []
    duration: float | None = None


class FillerCount(BaseModel):
    word: str
    count: int


class SpeechMetricsResponse(BaseModel):
    word_count: int
    duration: float
    wpm: float
    pace_label: str
    filler_total: int
    filler_rate: float
    fillers: list[FillerCount]
    pause_count: int
    longest_pause: float
    clarity: float
    wpm_series: list[float]


class FeedbackRequest(BaseModel):
    question: str = ""
    transcript: str
    metrics: SpeechMetricsResponse | None = None
    job_title: str = ""
    job_text: str = ""
    instructions: str = ""


class FeedbackResponse(BaseModel):
    overall: str
    rating: int = Field(ge=1, le=10)
    strengths: list[str]
    improvements: list[str]
    sample_answer: str
    source: Literal["gemini", "fallback"]
    note: str = ""
