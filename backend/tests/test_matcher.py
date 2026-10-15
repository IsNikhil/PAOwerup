import pytest
import tensorflow as tf

from app.ml import matcher


def test_rescale_clips_to_unit_range():
    assert float(matcher.rescale(0.0, 0.2, 0.7)) == 0.0
    assert float(matcher.rescale(0.95, 0.2, 0.7)) == 1.0
    assert float(matcher.rescale(0.45, 0.2, 0.7)) == pytest.approx(0.5)


def test_blend_uses_weights():
    assert matcher.blend(1, 1, 1) == pytest.approx(100.0)
    assert matcher.blend(0, 0, 0) == pytest.approx(0.0)
    expected = 100 * (matcher.W_SKILLS * 0.8 + matcher.W_SENTENCES * 0.5 + matcher.W_DOCUMENT * 0.2)
    assert matcher.blend(0.8, 0.5, 0.2) == pytest.approx(expected, rel=1e-5)
    assert matcher.W_SKILLS + matcher.W_SENTENCES + matcher.W_DOCUMENT == pytest.approx(1.0)


def test_cosine_matrix_on_unit_vectors():
    a = tf.linalg.l2_normalize(tf.constant([[1.0, 0.0], [1.0, 1.0]]), axis=1)
    b = tf.linalg.l2_normalize(tf.constant([[1.0, 0.0], [0.0, 1.0]]), axis=1)
    sims = matcher.cosine_matrix(a, b).numpy()
    assert sims[0, 0] == pytest.approx(1.0)
    assert sims[0, 1] == pytest.approx(0.0)
    assert sims[1, 0] == pytest.approx(0.7071, abs=1e-4)
    best = matcher.best_match_mean(a, b)
    assert float(best) == pytest.approx((1.0 + 0.7071) / 2, abs=1e-4)


def test_verdicts():
    assert matcher.verdict_for(85) == "Strong match"
    assert matcher.verdict_for(60) == "Good match"
    assert matcher.verdict_for(45) == "Fair match"
    assert matcher.verdict_for(10) == "Weak match"


@pytest.mark.slow
def test_use_embeddings_are_semantic():
    vecs = matcher.get_encoder().embed(["Wrote SQL queries for reports", "Experience writing SQL", "I bake sourdough bread"])
    sims = matcher.cosine_matrix(vecs, vecs).numpy()
    assert sims[0, 1] > sims[0, 2] + 0.2


@pytest.mark.slow
def test_end_to_end_strong_beats_weak(pairs):
    strong = matcher.match(*pairs["strong"])
    weak = matcher.match(*pairs["weak"])
    assert strong.score >= 60, strong.breakdown
    assert weak.score <= 30, weak.breakdown
    assert strong.score - weak.score >= 30
    assert strong.verdict in ("Strong match", "Good match")
    assert weak.verdict == "Weak match"

    matched = {m["name"] for m in strong.matched_skills}
    missing = {m["name"] for m in strong.missing_skills}
    assert {"SQL", "Python", "Tableau"} <= matched
    assert "Snowflake" in missing
    for m in strong.matched_skills:
        assert 1 <= len(m["evidence"]) <= 3
    for part in ("skill_coverage", "sentence_similarity", "document_similarity"):
        assert 0.0 <= strong.breakdown[part] <= 1.0


@pytest.mark.slow
def test_threshold_controls_semantic_matches(pairs):
    loose = matcher.match(*pairs["strong"], threshold=0.30)
    strict = matcher.match(*pairs["strong"], threshold=0.80)
    assert len(loose.matched_skills) >= len(strict.matched_skills)
    assert loose.score >= strict.score
