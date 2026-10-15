import io

import pytest
from docx import Document
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["gemini"]["status"] == "disabled"
    assert body["use"]["status"] in ("idle", "loading", "ready")


def test_parse_txt_and_reject_unknown(client):
    r = client.post("/api/parse-resume", files={"file": ("cv.txt", b"Jane Doe\nSQL and Python analyst", "text/plain")})
    assert r.status_code == 200 and r.json()["words"] == 6
    r = client.post("/api/parse-resume", files={"file": ("cv.png", b"\x89PNG", "image/png")})
    assert r.status_code == 415


def test_skills_endpoint(client, pairs):
    r = client.post("/api/skills", json={"resume_text": pairs["strong"][0], "job_text": pairs["strong"][1]})
    names = {s["name"] for s in r.json()["job"]}
    assert {"SQL", "Python", "Snowflake"} <= names


@pytest.mark.slow
def test_match_endpoint(client, pairs):
    r = client.post("/api/match", json={"resume_text": pairs["strong"][0], "job_text": pairs["strong"][1]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert 0 <= body["score"] <= 100 and body["matched_skills"]


def test_rewrite_fallback_never_claims_missing_skills(client, pairs):
    r = client.post("/api/rewrite", json={
        "resume_text": pairs["strong"][0], "job_text": pairs["strong"][1], "job_title": "Data Analyst",
        "matched_skills": ["SQL", "Python"], "missing_skills": ["Snowflake", "dbt"],
    })
    body = r.json()
    assert body["source"] == "fallback"
    doc = body["resume"]
    assert doc["name"] == "Sona Patel"
    assert "Snowflake" in doc["skills_to_develop"]
    assert all(s.lower() not in ("snowflake", "dbt") for s in doc["skills"])
    titles = [s["title"] for s in doc["sections"]]
    assert "Experience" in titles and "Education" in titles
    all_bullets = " ".join(b for s in doc["sections"] for i in s["items"] for b in i["bullets"])
    assert "Responsible for" not in all_bullets

    d = client.post("/api/rewrite/docx", json=doc)
    assert d.status_code == 200
    text = "\n".join(p.text for p in Document(io.BytesIO(d.content)).paragraphs)
    assert "Sona Patel" in text and "SKILLS TO DEVELOP" in text


def test_coach_and_questions_fallback(client):
    r = client.post("/api/coach", json={"job_title": "Data Analyst", "score": 72, "verdict": "Strong match",
                                        "matched_skills": ["SQL"], "missing_skills": ["Snowflake", "dbt"]})
    body = r.json()
    assert body["source"] == "fallback" and 3 <= len(body["steps"]) <= 5
    q = client.post("/api/interview/questions", json={"job_title": "Data Analyst", "missing_skills": ["Snowflake"]}).json()
    assert len(q["questions"]) >= 5 and any("Snowflake" in x for x in q["questions"])


def test_metrics_and_feedback(client):
    text = "Um, so I built a dashboard in Tableau that reduced reporting time by 50 percent for my team."
    m = client.post("/api/speech-metrics", json={"text": text, "duration": 6}).json()
    assert m["filler_total"] >= 2
    f = client.post("/api/interview/feedback", json={"question": "Tell me about a project", "transcript": text, "metrics": m}).json()
    assert f["source"] == "fallback" and 1 <= f["rating"] <= 10 and f["improvements"]


def test_presence_two_tabs(client):
    with client.websocket_connect("/ws/presence?name=Alice") as a:
        hello_a = a.receive_json()
        assert hello_a["type"] == "welcome" and hello_a["peers"] == []
        with client.websocket_connect("/ws/presence?name=Bob") as b:
            hello_b = b.receive_json()
            assert [p["name"] for p in hello_b["peers"]] == ["Alice"]
            assert a.receive_json()["type"] == "join"
            b.send_json({"type": "cursor", "x": 10, "y": 20})
            msg = a.receive_json()
            assert msg == {"type": "cursor", "id": hello_b["self"]["id"], "x": 10, "y": 20}
        assert a.receive_json()["type"] == "leave"
