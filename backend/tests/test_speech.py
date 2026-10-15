from app.ml import speech


def words_at(rate_s, tokens, gap_after=None):
    out, t = [], 0.0
    for i, w in enumerate(tokens):
        out.append({"word": w, "start": t, "end": t + rate_s * 0.8})
        t += rate_s
        if gap_after is not None and i == gap_after:
            t += 2.5
    return out


def test_fillers_ignore_real_usage():
    counts = speech.count_fillers("Um, so, I like SQL. You know, I basically, like, built dashboards. Uh I mean it worked.")
    assert counts["um"] == 1 and counts["uh"] == 1
    assert counts["you know"] == 1 and counts["i mean"] == 1
    assert counts["basically"] == 1
    assert counts["like"] == 1  # "I like SQL" is not a filler
    assert counts["so"] == 1


def test_wpm_and_pauses():
    tokens = ["word"] * 60
    m = speech.compute_metrics(" ".join(tokens), words_at(0.4, tokens, gap_after=30))
    assert 120 <= m["wpm"] <= 150
    assert m["pause_count"] == 1
    assert m["longest_pause"] >= 2.5
    assert m["wpm_series"]
    assert 0 <= m["clarity"] <= 100


def test_empty_transcript():
    m = speech.compute_metrics("")
    assert m["word_count"] == 0 and m["pace_label"] == "No speech"
