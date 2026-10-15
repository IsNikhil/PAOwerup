"""Interview practice: questions, Whisper transcription, speech metrics, feedback."""
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.ml import speech
from app.ml.whisper_service import whisper_service
from app.schemas import (
    FeedbackRequest, FeedbackResponse, QuestionsRequest, QuestionsResponse,
    SpeechMetricsRequest, SpeechMetricsResponse, TranscriptResponse,
)
from app.services import gemini

router = APIRouter()


@router.post("/interview/questions", response_model=QuestionsResponse)
async def questions(req: QuestionsRequest) -> QuestionsResponse:
    qs, source = await run_in_threadpool(gemini.interview_questions, req.job_text, req.job_title, req.missing_skills)
    return QuestionsResponse(questions=[q.strip() for q in qs if q.strip()][:8], source=source)


@router.post("/transcribe", response_model=TranscriptResponse)
async def transcribe(file: UploadFile = File(...), model: str = Form("base")) -> TranscriptResponse:
    data = await file.read()
    if len(data) < 1000:
        raise HTTPException(422, "Recording is empty — check microphone permission.")
    if len(data) > 40 * 1024 * 1024:
        raise HTTPException(413, "Recording is too large (max 40 MB).")
    try:
        out = await run_in_threadpool(whisper_service.transcribe, data, file.filename or "audio.webm", model)
    except RuntimeError as exc:
        raise HTTPException(500, str(exc)) from exc
    return TranscriptResponse(**out)


@router.post("/speech-metrics", response_model=SpeechMetricsResponse)
def speech_metrics(req: SpeechMetricsRequest) -> SpeechMetricsResponse:
    return SpeechMetricsResponse(**speech.compute_metrics(req.text, [w.model_dump() for w in req.words], req.duration))


@router.post("/interview/feedback", response_model=FeedbackResponse)
async def feedback(req: FeedbackRequest) -> FeedbackResponse:
    if not req.transcript.strip():
        raise HTTPException(422, "Transcript is empty.")
    metrics = req.metrics.model_dump() if req.metrics else speech.compute_metrics(req.transcript)
    out, source, note = await run_in_threadpool(
        gemini.interview_feedback, req.question, req.transcript, metrics, req.job_title, req.job_text, req.instructions,
    )
    data = gemini.to_dict(out)
    data["rating"] = max(1, min(10, int(data.get("rating", 5))))
    return FeedbackResponse(**data, source=source, note=note)
