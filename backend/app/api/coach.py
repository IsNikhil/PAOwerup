"""Gemini-powered endpoints: resume rewrite, DOCX export, career coach."""
import re

from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from app.schemas import CoachRequest, CoachResponse, CoachStep, ResumeDoc, RewriteRequest, RewriteResponse
from app.services import documents, gemini

router = APIRouter()


@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite(req: RewriteRequest) -> RewriteResponse:
    out, source, note = await run_in_threadpool(
        gemini.rewrite_resume, req.resume_text, req.job_text, req.job_title,
        req.matched_skills, req.missing_skills, req.tone, req.instructions,
    )
    doc = ResumeDoc.model_validate(gemini.to_dict(out))
    # Guard rail: missing skills may never be claimed as skills.
    missing = {m.lower() for m in req.missing_skills}
    moved = [s for s in doc.skills if s.lower() in missing]
    doc.skills = [s for s in doc.skills if s.lower() not in missing]
    doc.skills_to_develop = list(dict.fromkeys(doc.skills_to_develop + moved))
    return RewriteResponse(resume=doc, source=source, note=note)


@router.post("/rewrite/docx")
async def rewrite_docx(doc: ResumeDoc) -> Response:
    data = await run_in_threadpool(documents.build_docx, doc)
    slug = re.sub(r"[^A-Za-z0-9]+", "_", doc.name or "resume").strip("_") or "resume"
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{slug}_PAOwerUp.docx"'},
    )


@router.post("/coach", response_model=CoachResponse)
async def coach(req: CoachRequest) -> CoachResponse:
    out, source, note = await run_in_threadpool(
        gemini.coach, req.job_title, req.job_text, req.score, req.verdict,
        req.matched_skills, req.missing_skills, req.instructions,
    )
    data = gemini.to_dict(out)
    return CoachResponse(headline=data["headline"], steps=[CoachStep(**s) for s in data["steps"]][:5], source=source, note=note)
