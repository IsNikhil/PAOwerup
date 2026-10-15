"""Google Gemini calls (google-genai) with deterministic fallbacks.

Every public function returns ``(payload, source, note)`` where ``source`` is
``"gemini"`` or ``"fallback"``.  When ``GEMINI_API_KEY`` is missing or a call
fails, a template answer is produced so the rest of the pipeline still works.
"""
from __future__ import annotations

import json
import logging
import re
from typing import TypeVar

from pydantic import BaseModel

from app import config
from app.ml import skills as skill_lib

log = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)

_client = None
_last_error = ""

SYSTEM = (
    "You are PAOwerUp, a precise, encouraging career coach for university students. "
    "You never invent experience, employers, dates, degrees, numbers or certifications that are not in the user's text. "
    "Be specific to the job and concise."
)


def enabled() -> bool:
    return bool(config.GEMINI_API_KEY)


def status() -> tuple[str, str]:
    if not enabled():
        return "disabled", "Set GEMINI_API_KEY in backend/.env to connect Gemini"
    if _last_error:
        return "error", _last_error
    return "ready", config.GEMINI_MODEL


def _get_client():
    global _client
    if _client is None:
        from google import genai

        _client = genai.Client(api_key=config.GEMINI_API_KEY)
    return _client


def _generate(prompt: str, schema: type[T], temperature: float = 0.4) -> T:
    global _last_error
    from google.genai import types

    cfg = types.GenerateContentConfig(
        system_instruction=SYSTEM,
        temperature=temperature,
        response_mime_type="application/json",
        response_schema=schema,
    )
    if "2.5-flash" in config.GEMINI_MODEL:
        cfg.thinking_config = types.ThinkingConfig(thinking_budget=0)  # faster, plenty for these tasks
    try:
        resp = _get_client().models.generate_content(model=config.GEMINI_MODEL, contents=prompt, config=cfg)
        parsed = resp.parsed if isinstance(resp.parsed, schema) else schema.model_validate_json(resp.text or "{}")
    except Exception as exc:
        _last_error = f"{type(exc).__name__}: {str(exc)[:200]}"
        raise
    _last_error = ""
    return parsed


def _extra(instructions: str) -> str:
    return f"\n\nExtra instructions from the user (follow them unless they ask you to invent experience):\n{instructions.strip()}" if instructions.strip() else ""


def _call(prompt: str, schema: type[T], fallback, temperature: float = 0.4) -> tuple[T | object, str, str]:
    if not enabled():
        return fallback(), "fallback", "Gemini not connected — showing template output."
    try:
        return _generate(prompt, schema, temperature), "gemini", ""
    except Exception as exc:  # network, quota, safety, bad key...
        log.warning("Gemini call failed: %s", exc)
        return fallback(), "fallback", f"Gemini error ({type(exc).__name__}) — showing template output."


# ======================================================================== skills
class _SkillList(BaseModel):
    resume_skills: list[str]
    job_skills: list[str]


def extra_skills(resume_text: str, job_text: str) -> tuple[list[str], list[str], str]:
    """Ask Gemini for concrete skills the taxonomy may have missed."""
    prompt = (
        "List concrete, resume-worthy skills (tools, technologies, methods, domain or soft skills) explicitly present in each text. "
        "Use short canonical names (1-3 words). Max 25 per list. Do not infer skills that are not stated.\n\n"
        f"RESUME:\n{resume_text[:12000]}\n\nJOB DESCRIPTION:\n{job_text[:8000]}"
    )
    out, source, note = _call(prompt, _SkillList, lambda: _SkillList(resume_skills=[], job_skills=[]), 0.1)
    return out.resume_skills, out.job_skills, note if source == "fallback" else ""


# ======================================================================== rewrite
class _Item(BaseModel):
    heading: str
    subheading: str
    dates: str
    bullets: list[str]


class _Section(BaseModel):
    title: str
    items: list[_Item]


class _Resume(BaseModel):
    name: str
    headline: str
    contact: str
    summary: str
    sections: list[_Section]
    skills: list[str]
    skills_to_develop: list[str]
    changes: list[str]


TONES = {
    "Professional": "polished and professional",
    "Concise": "tight and concise — short bullets, no filler words",
    "Bold": "confident and results-forward, with strong action verbs (but still truthful)",
}


def rewrite_resume(resume_text: str, job_text: str, job_title: str, matched: list[str], missing: list[str], tone: str, instructions: str):
    prompt = f"""Rewrite this resume so it targets the job below. Tone: {TONES.get(tone, TONES['Professional'])}.

Rules (strict):
- Keep every real employer, title, school, date and project. Do NOT add jobs, projects, degrees, certifications or metrics that are not in the original.
- Improve wording with strong action verbs. Only quantify where the original already contains a number.
- Reorder sections and bullets so the most job-relevant experience and skills come first.
- 'skills' = skills the candidate actually shows in the original, ordered by relevance to the job.
- Missing skills may ONLY appear in 'skills_to_develop' — never as claimed experience.
- 'headline' is a one-line professional headline for this target role. 'contact' is one line from the original contact info.
- 'changes' = 3-6 short notes describing what you changed and why.

Target job title: {job_title or 'see job description'}
Skills already matched: {', '.join(matched) or 'n/a'}
Skills missing (put in skills_to_develop only): {', '.join(missing) or 'none'}

JOB DESCRIPTION:
{job_text[:8000]}

ORIGINAL RESUME:
{resume_text[:12000]}{_extra(instructions)}"""
    return _call(prompt, _Resume, lambda: fallback_rewrite(resume_text, job_text, job_title, matched, missing, tone))


# ======================================================================== coach
class _Step(BaseModel):
    title: str
    detail: str
    timeframe: str


class _Coach(BaseModel):
    headline: str
    steps: list[_Step]


def coach(job_title: str, job_text: str, score: float, verdict: str, matched: list[str], missing: list[str], instructions: str):
    prompt = f"""Give personalised career guidance for a student applying to this role.
Match score from our TensorFlow model: {score:.0f}/100 ({verdict}).
Matched skills: {', '.join(matched) or 'none'}
Missing skills: {', '.join(missing) or 'none'}
Job title: {job_title or 'n/a'}
Job description (excerpt): {job_text[:4000]}

Return a one-sentence 'headline' and 3-5 concrete next 'steps'. Each step: short title, a specific 1-2 sentence detail
(name real free resources or project ideas where useful), and a timeframe like 'This week' or '2-4 weeks'.{_extra(instructions)}"""
    return _call(prompt, _Coach, lambda: fallback_coach(job_title, score, verdict, matched, missing), 0.5)


# ======================================================================== interview
class _Questions(BaseModel):
    questions: list[str]


FALLBACK_QUESTIONS = [
    "Tell me about yourself and why you're interested in this role.",
    "Describe a project you're proud of. What was your specific contribution?",
    "Tell me about a time you had to learn a new tool or skill quickly.",
    "Describe a time you worked through a disagreement on a team.",
    "How do you explain a technical result to a non-technical audience?",
]


def interview_questions(job_text: str, job_title: str, missing: list[str]):
    def fb():
        qs = list(FALLBACK_QUESTIONS)
        if job_title:
            qs[0] = f"Tell me about yourself and why you want to be a {job_title}."
        if missing:
            qs.insert(2, f"This role uses {missing[0]}. How would you get up to speed with it in your first month?")
        return _Questions(questions=qs[:6])

    prompt = (
        f"Write 6 realistic interview questions for this role (mix of behavioral and role-specific, one about a skill gap if any: "
        f"{', '.join(missing[:3]) or 'none'}). Each under 25 words.\nJob title: {job_title}\n\n{job_text[:6000]}"
    )
    out, source, _ = _call(prompt, _Questions, fb, 0.7)
    return out.questions, source


class _Feedback(BaseModel):
    overall: str
    rating: int
    strengths: list[str]
    improvements: list[str]
    sample_answer: str


def interview_feedback(question: str, transcript: str, metrics: dict | None, job_title: str, job_text: str, instructions: str):
    m = metrics or {}
    prompt = f"""Give interview feedback on this spoken answer.
Question: {question or 'General interview question'}
Job: {job_title or 'n/a'} — {job_text[:2500]}
Transcript: \"\"\"{transcript[:6000]}\"\"\"
Speech metrics: {m.get('wpm', '?')} words/min ({m.get('pace_label', '')}), {m.get('filler_total', 0)} filler words
({', '.join(f"{f['word']}×{f['count']}" for f in m.get('fillers', [])[:5]) or 'none'}), longest pause {m.get('longest_pause', 0)}s.

Return: 'overall' (2 sentences), 'rating' 1-10, 2-4 'strengths', 2-4 specific 'improvements' (mention pace/fillers if relevant),
and a 'sample_answer' (STAR format, 90-130 words) that stays consistent with facts in the transcript and does not invent new achievements.{_extra(instructions)}"""
    return _call(prompt, _Feedback, lambda: fallback_feedback(question, transcript, m), 0.5)


# ======================================================================== fallbacks
SECTION_WORDS = {
    "summary": "Summary", "profile": "Summary", "objective": "Summary", "about": "Summary",
    "education": "Education", "experience": "Experience", "work experience": "Experience",
    "employment": "Experience", "professional experience": "Experience", "projects": "Projects",
    "skills": "Skills", "technical skills": "Skills", "certifications": "Certifications",
    "leadership": "Leadership", "activities": "Activities", "awards": "Awards", "volunteer": "Volunteer",
}
# Gerund -> past tense for "Responsible for managing X" -> "Managed X".
PAST = {
    "managing": "Managed", "maintaining": "Maintained", "creating": "Created", "resolving": "Resolved",
    "developing": "Developed", "building": "Built", "leading": "Led", "coordinating": "Coordinated",
    "handling": "Handled", "training": "Trained", "writing": "Wrote", "designing": "Designed",
    "analyzing": "Analyzed", "analysing": "Analysed", "organizing": "Organized", "overseeing": "Oversaw",
    "preparing": "Prepared", "monitoring": "Monitored", "tracking": "Tracked", "ensuring": "Ensured",
    "processing": "Processed", "answering": "Answered", "supporting": "Supported", "updating": "Updated",
    "scheduling": "Scheduled", "reviewing": "Reviewed", "testing": "Tested", "implementing": "Implemented",
    "conducting": "Conducted", "delivering": "Delivered", "providing": "Provided", "planning": "Planned",
    "running": "Ran", "teaching": "Taught", "assisting": "Assisted", "collecting": "Collected",
}


def _gerund(verb: str) -> str:
    v = verb.lower()
    if v.endswith("e") and not v.endswith("ee"):
        return v[:-1] + "ing"
    if re.fullmatch(r"[^aeiou]*[aeiou][^aeiouwxy]", v) and len(v) <= 4:
        return v + v[-1] + "ing"
    return v + "ing"


def _opener(m: re.Match) -> str:
    rest = m.group("rest")
    word, _, tail = rest.partition(" ")
    if word.lower() in PAST:
        return f"{PAST[word.lower()]} {tail}".strip()
    if word.lower().endswith("ing"):
        return m.group(0)  # unknown verb form: leave the original untouched
    return f"Owned {rest}"


WEAK_OPENERS = [
    (r"^(responsible for|in charge of|tasked with)\s+(?P<rest>.+)$", _opener),
    (r"^worked (on|in|with) (a|an|the) team\b", lambda m: "Collaborated in a team"),
    (r"^worked on\s+", lambda m: "Contributed to "),
    (r"^helped (to )?(?P<verb>[a-z]+)\s+", lambda m: f"Contributed to {_gerund(m.group('verb'))} "),
    (r"^assisted (with|in)\s+", lambda m: "Supported "),
]
_DATE = re.compile(r"((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s+\d{4}|\b(19|20)\d{2}\b)(\s*[–\-—to]+\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s+\d{4}|\b(19|20)\d{2}\b|present|current))?", re.I)


def _strengthen(bullet: str) -> str:
    b = bullet.strip().rstrip(".")
    for pat, repl in WEAK_OPENERS:
        new = re.sub(pat, repl, b, count=1, flags=re.I)
        if new != b:
            b = new
            break
    return b[:1].upper() + b[1:]


def _relevance(text: str, keywords: list[str]) -> int:
    low = text.lower()
    return sum(1 for k in keywords if k.lower() in low)


def fallback_rewrite(resume_text: str, job_text: str, job_title: str, matched: list[str], missing: list[str], tone: str):
    lines = [l.strip() for l in resume_text.splitlines()]
    lines = [l for l in lines if l]
    name = lines[0] if lines and len(lines[0].split()) <= 5 else ""
    contact = lines[1] if len(lines) > 1 and ("@" in lines[1] or re.search(r"\d{3}", lines[1])) else ""
    body = lines[(1 if name else 0) + (1 if contact else 0):]

    sections: list[dict] = []
    current: dict | None = None
    item: dict | None = None
    skills_line = ""
    for line in body:
        key = re.sub(r"[^a-z ]", "", line.lower()).strip()
        if key in SECTION_WORDS and len(line) < 40:
            current = {"title": SECTION_WORDS[key], "items": []}
            sections.append(current)
            item = None
            continue
        if current is None:
            current = {"title": "Summary", "items": []}
            sections.append(current)
        if current["title"] == "Skills":
            skills_line += " " + line
            continue
        is_bullet = bool(re.match(r"^[•●▪◦‣∙·\-*–]\s*", line))
        text = re.sub(r"^[•●▪◦‣∙·\-*–]\s*", "", line)
        if is_bullet or (item and len(text.split()) > 9 and not _DATE.search(text)):
            if item is None:
                item = {"heading": "", "subheading": "", "dates": "", "bullets": []}
                current["items"].append(item)
            item["bullets"].append(_strengthen(text))
        else:
            dates = ""
            m = _DATE.search(text)
            if m:
                dates = m.group(0).strip()
                text = text.replace(m.group(0), "").strip(" ,·|—-")
            parts = re.split(r"\s+[—–|]\s+|\s+-\s+", text, maxsplit=1)
            head = parts[0]
            sub = parts[1] if len(parts) > 1 else ""
            item = {"heading": head, "subheading": sub, "dates": dates, "bullets": []}
            current["items"].append(item)

    keywords = matched + missing + [m.name for m in skill_lib.extract_skills(job_text)]
    order = {"Summary": 0, "Experience": 1, "Projects": 2, "Education": 3}
    sections = [s for s in sections if s["items"]]
    for s in sections:
        if s["title"] != "Experience":
            continue  # keep project/education bullets in their original story order
        for it in s["items"]:
            it["bullets"].sort(key=lambda b: -_relevance(b, keywords))
    sections.sort(key=lambda s: order.get(s["title"], 5))
    summary_section = next((s for s in sections if s["title"] == "Summary"), None)
    summary = " ".join(" ".join(i["bullets"]) or i["heading"] for i in summary_section["items"]) if summary_section else ""
    sections = [s for s in sections if s["title"] != "Summary"]

    resume_skills = [m.name for m in skill_lib.extract_skills(resume_text)]
    raw_skills = [s.strip() for s in re.split(r",|;|·|\|", skills_line) if s.strip()]
    skills = list(dict.fromkeys([s for s in resume_skills if s in matched] + resume_skills + raw_skills))[:24]
    short_title = job_title.split("@")[0].strip()
    role = f"a {short_title} role" if short_title else "the target role"
    if not summary:
        top = ", ".join(skills[:4])
        summary = f"Motivated candidate targeting {role}, with hands-on experience in {top}." if top else f"Motivated candidate targeting {role}."

    from app.schemas import ResumeDoc

    return ResumeDoc(
        name=name, headline=f"Aspiring {short_title}" if short_title else "", contact=contact, summary=summary,
        sections=sections, skills=skills, skills_to_develop=missing[:8],
        changes=[
            "Reordered bullets so job-relevant skills appear first.",
            "Replaced weak openers (\"Responsible for\", \"Helped\", \"Worked on\") with action verbs.",
            "Put matched skills at the front of the Skills list.",
            "Listed missing skills under \"Skills to develop\" instead of claiming them.",
            "Connect Gemini for a full AI rewrite.",
        ],
    )


def fallback_coach(job_title: str, score: float, verdict: str, matched: list[str], missing: list[str]):
    steps = []
    for name in missing[:3]:
        steps.append(_Step(title=f"Learn {name}", detail=skill_lib.hint_for(name), timeframe="2-4 weeks"))
    if matched:
        steps.append(_Step(
            title="Lead with your strengths",
            detail=f"Move {', '.join(matched[:3])} to the top of your resume and mention them in your summary.",
            timeframe="Today",
        ))
    steps.append(_Step(
        title="Practise your interview story",
        detail="Record a 60-90 second answer to 'Tell me about yourself' in the Interview Recorder and aim for under 3% filler words.",
        timeframe="This week",
    ))
    headline = f"{verdict or 'Your match'} ({score:.0f}/100) for {job_title or 'this role'}: close the top gaps and lead with what you already do well."
    return _Coach(headline=headline, steps=steps[:5])


def fallback_feedback(question: str, transcript: str, m: dict):
    wpm = m.get("wpm", 0) or 0
    fillers = m.get("filler_total", 0) or 0
    words = len(transcript.split())
    strengths, improvements = [], []
    if 120 <= wpm <= 160:
        strengths.append(f"Comfortable pace at {wpm:.0f} words per minute.")
    elif wpm:
        improvements.append(f"Your pace was {wpm:.0f} wpm; aim for 120-160 so it sounds natural and confident.")
    if fillers <= 2:
        strengths.append("Very few filler words — you sound prepared.")
    else:
        improvements.append(f"You used {fillers} filler words. Pause silently instead of saying 'um' or 'like'.")
    if words >= 60:
        strengths.append("Answer had enough detail to be substantive.")
    else:
        improvements.append("Give a fuller answer (45-90 seconds) with a concrete example.")
    result_words = r"\b(result|results|increased|reduced|improved|saved|cut|grew|percent|hours|days|weeks|\d+%?|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand)\b"
    if not re.search(result_words, transcript, re.I):
        improvements.append("End with a measurable result (STAR: Situation, Task, Action, Result).")
    else:
        strengths.append("You mentioned a concrete result.")
    rating = max(1, min(10, 5 + len(strengths) - len(improvements) // 2))
    first = transcript.strip().split(".")[0][:140]
    sample = (
        "Situation: briefly set the scene in one sentence. "
        "Task: say what you were responsible for. "
        f"Action: describe 2-3 specific steps you took{(' — for example, building on: “' + first + '”') if first else ''}. "
        "Result: finish with the outcome and, if you have it, a number that shows impact."
    )
    return _Feedback(
        overall="Template feedback based on your speech metrics. Connect Gemini for content-specific coaching.",
        rating=rating, strengths=strengths or ["You completed the answer."], improvements=improvements or ["Keep practising with new questions."],
        sample_answer=sample,
    )


def to_dict(obj) -> dict:
    return json.loads(obj.model_dump_json()) if isinstance(obj, BaseModel) else dict(obj)
