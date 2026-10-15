"""Resume parsing, skill extraction and the TensorFlow match endpoint."""
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.ml import matcher
from app.ml import skills as skill_lib
from app.schemas import MatchRequest, MatchResponse, ParseResumeResponse, SkillHit, SkillsRequest, SkillsResponse
from app.services import documents, gemini

router = APIRouter()
MAX_UPLOAD = 8 * 1024 * 1024


@router.post("/parse-resume", response_model=ParseResumeResponse)
async def parse_resume(file: UploadFile = File(...)) -> ParseResumeResponse:
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "File is larger than 8 MB")
    try:
        text = await run_in_threadpool(documents.extract_text, file.filename or "", data)
    except ValueError as exc:
        raise HTTPException(415, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(422, f"Could not read this file: {exc}") from exc
    if not text.strip():
        raise HTTPException(422, "No text found. Scanned PDFs need OCR — try a DOCX or TXT export instead.")
    return ParseResumeResponse(filename=file.filename or "", text=text, chars=len(text), words=len(text.split()))


def _hits(mentions) -> list[SkillHit]:
    return [SkillHit(name=m.name, category=m.category, count=m.count) for m in mentions]


@router.post("/skills", response_model=SkillsResponse)
async def skills(req: SkillsRequest) -> SkillsResponse:
    resume = _hits(skill_lib.extract_skills(req.resume_text))
    job = _hits(skill_lib.extract_skills(req.job_text))
    note, used = "", False
    if req.source == "taxonomy+gemini":
        r_extra, j_extra, note = await run_in_threadpool(gemini.extra_skills, req.resume_text, req.job_text)
        used = not note
        for target, extra in ((resume, r_extra), (job, j_extra)):
            known = {h.name.lower() for h in target}
            for name in extra:
                canon = skill_lib.get_skill(name)
                label = canon.name if canon else name.strip()
                if label and label.lower() not in known and len(label) <= 40:
                    known.add(label.lower())
                    target.append(SkillHit(name=label, category=canon.category if canon else "other", source="gemini"))
    return SkillsResponse(resume=resume, job=job, gemini_used=used, note=note)


@router.post("/match", response_model=MatchResponse)
async def match(req: MatchRequest) -> MatchResponse:
    if len(req.resume_text.split()) < 5 or len(req.job_text.split()) < 5:
        raise HTTPException(422, "Resume and job description both need some text.")
    try:
        result = await run_in_threadpool(
            matcher.match, req.resume_text, req.job_text,
            model=req.model, threshold=req.threshold, top_k=req.top_k,
            resume_skills=req.resume_skills, job_skills=req.job_skills,
        )
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    return MatchResponse(**result.to_dict())
