"""PAOwerUp match engine — TensorFlow + Universal Sentence Encoder (USE).

How a match score is computed
=============================

1. **Clean & split.**  The resume and the job description (JD) are split into
   sentences / bullet points (:func:`app.ml.skills.split_sentences`).

2. **Extract skills.**  Both texts are scanned against the built-in taxonomy
   (``app/data/skills.json``) so we know which skills the JD asks for and which
   the resume mentions.  Gemini can optionally add skills the taxonomy missed.

3. **Embed with USE in TensorFlow.**  Every sentence, every skill name and both
   whole documents are turned into 512-dimensional vectors by the Universal
   Sentence Encoder, loaded from TF-Hub.  Vectors are L2-normalised with
   ``tf.linalg.l2_normalize`` so a dot product (``tf.matmul``) *is* the
   cosine similarity.  All similarity math below happens in TensorFlow.

4. **Semantic similarity (two signals).**
   * *Document similarity* — cosine between the whole-resume and whole-JD
     embeddings.  Captures overall topic/domain fit.
   * *Sentence similarity* — build the matrix ``S = J · Rᵀ`` (JD sentences ×
     resume sentences), take each JD sentence's best resume sentence
     (``tf.reduce_max`` over rows), then average (``tf.reduce_mean``).  This
     asks "is every requirement addressed somewhere in the resume?".

5. **Skill coverage.**  For each JD skill:
   * mentioned verbatim (or via an alias) in the resume → *exact* match,
     credit 1.0;
   * otherwise compare its embedding against every resume skill and resume
     sentence; if the best cosine ≥ ``threshold`` (default 0.50) it is a
     *semantic* match with credit equal to that similarity (e.g. "PostgreSQL"
     vs. a resume that only says "MySQL");
   * below the threshold → missing.
   Coverage is the importance-weighted average credit.  The top-k most similar
   resume sentences are returned as evidence for each matched skill.

6. **Blend.**  Raw USE cosines for related text usually sit between ~0.15 and
   ~0.75, so the two similarity signals are linearly rescaled to ``[0, 1]``
   (``DOC_FLOOR..DOC_CEIL`` and ``SENT_FLOOR..SENT_CEIL``).  Then::

       score = 100 × (W_SKILLS·coverage + W_SENTENCES·sentence + W_DOCUMENT·document)

7. **Verdict.**  ≥70 Strong, ≥55 Good, ≥40 Fair, otherwise Weak.
"""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field

from app import config  # noqa: F401  (sets TFHUB_CACHE_DIR before TF import)

import tensorflow as tf  # noqa: E402

from app.ml import skills as skill_lib  # noqa: E402

log = logging.getLogger(__name__)

# ------------------------------------------------------------------ constants
W_SKILLS = 0.45  # weight of skill coverage in the final score
W_SENTENCES = 0.35  # weight of sentence-level similarity
W_DOCUMENT = 0.20  # weight of whole-document similarity

# Raw USE cosines are rescaled to 0-1. Whole documents share lots of generic
# vocabulary, so their range sits higher than sentence-to-sentence matches.
DOC_FLOOR, DOC_CEIL = 0.20, 0.70  # whole-document cosine range
SENT_FLOOR, SENT_CEIL = 0.10, 0.50  # mean best-sentence cosine range

DEFAULT_THRESHOLD = 0.50
DEFAULT_TOP_K = 3

VERDICTS = ((70, "Strong match"), (55, "Good match"), (40, "Fair match"), (0, "Weak match"))


# ------------------------------------------------------------------ encoder
class USEEncoder:
    """Loads a Universal Sentence Encoder from TF-Hub once and caches it.

    ``status`` is one of ``idle | loading | ready | error`` and is surfaced by
    ``GET /api/health`` so the UI can show the "TF ●" ready indicator.
    """

    def __init__(self, key: str, url: str):
        self.key = key
        self.url = url
        self.status = "idle"
        self.detail = ""
        self._model = None
        self._lock = threading.Lock()
        self._ready = threading.Event()

    def load(self) -> None:
        with self._lock:
            if self._model is not None:
                return
            import tensorflow_hub as hub

            self.status, self.detail = "loading", f"Loading {self.key} from TF-Hub"
            t0 = time.perf_counter()
            try:
                self._model = hub.load(self.url)
                # Warm up with a few batch sizes so the first real request is fast.
                for n in (1, 2, 7):
                    self._model(tf.constant(["warm up sentence"] * n))
            except Exception as exc:  # pragma: no cover - network failures
                self.status, self.detail = "error", f"{type(exc).__name__}: {exc}"
                log.exception("USE load failed")
                self._ready.set()
                raise
            self.status = "ready"
            self.detail = f"{self.key} loaded in {time.perf_counter() - t0:.1f}s"
            self._ready.set()
            log.info(self.detail)

    def wait(self, timeout: float = 300) -> None:
        if self._model is None and self.status in ("idle",):
            self.load()
        self._ready.wait(timeout)
        if self._model is None:
            raise RuntimeError(f"USE model '{self.key}' not available: {self.detail}")

    def embed(self, texts: list[str]) -> tf.Tensor:
        """Return L2-normalised embeddings, shape ``[len(texts), 512]``."""
        self.wait()
        if not texts:
            return tf.zeros((0, 512), dtype=tf.float32)
        vectors = self._model(tf.constant(texts))
        return tf.linalg.l2_normalize(vectors, axis=1)


ENCODERS: dict[str, USEEncoder] = {k: USEEncoder(k, url) for k, url in config.USE_MODELS.items()}


def get_encoder(key: str = config.DEFAULT_USE_MODEL) -> USEEncoder:
    return ENCODERS.get(key) or ENCODERS[config.DEFAULT_USE_MODEL]


# ------------------------------------------------------------------ math helpers
def cosine_matrix(a: tf.Tensor, b: tf.Tensor) -> tf.Tensor:
    """Cosine similarity of every row of ``a`` with every row of ``b``.

    Inputs are already unit-length, so ``a · bᵀ`` equals the cosine.
    """
    return tf.matmul(a, b, transpose_b=True)


def rescale(similarity: tf.Tensor | float, floor: float, ceil: float) -> tf.Tensor:
    """Map a raw cosine from [floor, ceil] to [0, 1] (clipped)."""
    x = tf.convert_to_tensor(similarity, dtype=tf.float32)
    return tf.clip_by_value((x - floor) / (ceil - floor), 0.0, 1.0)


def best_match_mean(job_vecs: tf.Tensor, resume_vecs: tf.Tensor) -> tf.Tensor:
    """Mean over JD sentences of each one's best-matching resume sentence."""
    if job_vecs.shape[0] == 0 or resume_vecs.shape[0] == 0:
        return tf.constant(0.0)
    sims = cosine_matrix(job_vecs, resume_vecs)
    return tf.reduce_mean(tf.reduce_max(sims, axis=1))


def blend(coverage: float, sentence: float, document: float) -> float:
    """Weighted blend of the three 0-1 components into a 0-100 score."""
    parts = tf.constant([coverage, sentence, document], dtype=tf.float32)
    weights = tf.constant([W_SKILLS, W_SENTENCES, W_DOCUMENT], dtype=tf.float32)
    return float(100.0 * tf.reduce_sum(parts * weights) / tf.reduce_sum(weights))


def verdict_for(score: float) -> str:
    for cutoff, label in VERDICTS:
        if score >= cutoff:
            return label
    return "Weak match"


# ------------------------------------------------------------------ result types
@dataclass
class MatchResult:
    score: float
    verdict: str
    summary: str
    breakdown: dict[str, float]
    matched_skills: list[dict] = field(default_factory=list)
    missing_skills: list[dict] = field(default_factory=list)
    model: str = ""
    threshold: float = DEFAULT_THRESHOLD
    elapsed_ms: float = 0.0
    resume_sentences: int = 0
    job_sentences: int = 0

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "verdict": self.verdict,
            "summary": self.summary,
            "breakdown": self.breakdown,
            "weights": {"skill_coverage": W_SKILLS, "sentence_similarity": W_SENTENCES, "document_similarity": W_DOCUMENT},
            "matched_skills": self.matched_skills,
            "missing_skills": self.missing_skills,
            "model": self.model,
            "threshold": self.threshold,
            "elapsed_ms": self.elapsed_ms,
            "resume_sentences": self.resume_sentences,
            "job_sentences": self.job_sentences,
        }


# ------------------------------------------------------------------ main entry point
def match(
    resume_text: str,
    job_text: str,
    *,
    model: str = config.DEFAULT_USE_MODEL,
    threshold: float = DEFAULT_THRESHOLD,
    top_k: int = DEFAULT_TOP_K,
    resume_skills: list[str] | None = None,
    job_skills: list[str] | None = None,
    job_title: str = "",
) -> MatchResult:
    """Compare a resume with a job description and return a :class:`MatchResult`.

    ``resume_skills`` / ``job_skills`` may be passed in (e.g. after Gemini added
    extra skills); otherwise they are extracted from the taxonomy here.
    """
    t0 = time.perf_counter()
    encoder = get_encoder(model)

    # 1. sentences ----------------------------------------------------------
    resume_sents = skill_lib.split_sentences(resume_text)
    job_sents = skill_lib.split_sentences(job_text)
    if not resume_sents:
        resume_sents = [resume_text.strip()[:600] or "empty"]
    if not job_sents:
        job_sents = [job_text.strip()[:600] or "empty"]

    # 2. skills -------------------------------------------------------------
    job_mentions = {m.name: m for m in skill_lib.extract_skills(job_text)}
    resume_mentions = {m.name: m for m in skill_lib.extract_skills(resume_text)}
    job_skill_names = list(dict.fromkeys(job_skills if job_skills is not None else job_mentions.keys()))
    resume_skill_names = list(dict.fromkeys(resume_skills if resume_skills is not None else resume_mentions.keys()))
    resume_lower = {s.lower() for s in resume_skill_names}

    # 3. embeddings (one batched TF call per group) --------------------------
    doc_vecs = encoder.embed([resume_text[:20000], job_text[:20000]])
    resume_vecs = encoder.embed(resume_sents)
    job_vecs = encoder.embed(job_sents)
    job_skill_vecs = encoder.embed(job_skill_names)
    resume_skill_vecs = encoder.embed(resume_skill_names)

    # 4. semantic similarity -------------------------------------------------
    raw_doc = float(tf.reduce_sum(doc_vecs[0] * doc_vecs[1]))
    raw_sent = float(best_match_mean(job_vecs, resume_vecs))
    document_sim = float(rescale(raw_doc, DOC_FLOOR, DOC_CEIL))
    sentence_sim = float(rescale(raw_sent, SENT_FLOOR, SENT_CEIL))

    # 5. skill coverage ------------------------------------------------------
    matched: list[dict] = []
    missing: list[dict] = []
    weighted_credit = 0.0
    total_weight = 0.0

    if job_skill_names:
        # [n_job_skills, n_resume_sentences] and [n_job_skills, n_resume_skills]
        skill_vs_sents = cosine_matrix(job_skill_vecs, resume_vecs)
        if resume_skill_names:
            skill_vs_skills = cosine_matrix(job_skill_vecs, resume_skill_vecs)
        else:
            skill_vs_skills = tf.zeros((len(job_skill_names), 0))
        k = min(top_k, len(resume_sents))
        top_vals, top_idx = tf.math.top_k(skill_vs_sents, k=k)
        best_sent = tf.reduce_max(skill_vs_sents, axis=1)

        for i, name in enumerate(job_skill_names):
            mention = job_mentions.get(name) or skill_lib.SkillMention(name, "other", 1, [])
            importance = skill_lib.skill_importance(mention, job_title)
            total_weight += importance

            best_skill_sim, best_skill_name = 0.0, ""
            if resume_skill_names:
                j = int(tf.argmax(skill_vs_skills[i]))
                best_skill_sim, best_skill_name = float(skill_vs_skills[i, j]), resume_skill_names[j]
            sent_sim = float(best_sent[i])

            evidence = [
                {"sentence": resume_sents[int(idx)], "similarity": round(float(val), 3)}
                for val, idx in zip(top_vals[i].numpy(), top_idx[i].numpy())
            ]

            if name.lower() in resume_lower:
                credit, sim, kind, partner = 1.0, 1.0, "exact", name
                # Prefer sentences that literally mention the skill as evidence.
                literal = resume_mentions.get(name)
                if literal and literal.sentences:
                    lit = [{"sentence": s, "similarity": 1.0} for s in literal.sentences[:top_k]]
                    evidence = (lit + [e for e in evidence if e["sentence"] not in literal.sentences])[:top_k]
            else:
                sim = max(best_skill_sim, sent_sim)
                partner = best_skill_name if best_skill_sim >= sent_sim else "resume text"
                kind = "semantic"
                credit = sim if sim >= threshold else 0.0

            weighted_credit += importance * credit
            if credit > 0:
                matched.append({
                    "name": name, "similarity": round(sim, 3), "match_type": kind,
                    "matched_with": partner, "evidence": evidence, "hint": "",
                })
            else:
                missing.append({
                    "name": name, "similarity": round(sim, 3), "importance": importance,
                    "importance_label": skill_lib.importance_label(importance),
                    "closest": best_skill_name if best_skill_sim >= sent_sim else (evidence[0]["sentence"] if evidence else ""),
                    "hint": skill_lib.hint_for(name),
                })
        coverage = weighted_credit / total_weight if total_weight else 0.0
    else:
        # The JD names no recognisable skills: fall back to sentence similarity.
        coverage = sentence_sim

    # 6. blend ---------------------------------------------------------------
    score = round(blend(coverage, sentence_sim, document_sim), 1)
    verdict = verdict_for(score)
    matched.sort(key=lambda m: (m["match_type"] != "exact", -m["similarity"]))
    missing.sort(key=lambda m: -m["importance"])

    summary = _summary(verdict, len(matched), len(job_skill_names), missing)
    return MatchResult(
        score=score,
        verdict=verdict,
        summary=summary,
        breakdown={
            "skill_coverage": round(coverage, 4),
            "sentence_similarity": round(sentence_sim, 4),
            "document_similarity": round(document_sim, 4),
            "raw_document_cosine": round(raw_doc, 4),
            "raw_sentence_mean": round(raw_sent, 4),
        },
        matched_skills=matched,
        missing_skills=missing,
        model=encoder.key,
        threshold=threshold,
        elapsed_ms=round((time.perf_counter() - t0) * 1000, 1),
        resume_sentences=len(resume_sents),
        job_sentences=len(job_sents),
    )


def _summary(verdict: str, n_matched: int, n_total: int, missing: list[dict]) -> str:
    if n_total == 0:
        return f"{verdict}: no specific skills were detected in the job description, so the score is based on semantic similarity."
    top_missing = [m["name"] for m in missing[:2]]
    gap = f" Biggest gaps: {', '.join(top_missing)}." if top_missing else " No major skill gaps."
    return f"{verdict} — you cover {n_matched} of {n_total} skills this role asks for.{gap}"
