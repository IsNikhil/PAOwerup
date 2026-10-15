from app.ml import skills


def names(text):
    return {m.name for m in skills.extract_skills(text)}


def test_aliases_map_to_canonical_names():
    found = names("Built ML models in python3 with TF2; front end in js and k8s for deploys.")
    assert {"Machine Learning", "Python", "TensorFlow", "JavaScript", "Kubernetes"} <= found


def test_symbols_and_word_boundaries():
    found = names("Languages: C++, C#, Node.js, .NET and R. I like Java.")
    assert {"C++", "C#", "Node.js", "ASP.NET", "R", "Java"} <= found
    assert "JavaScript" not in found
    assert "C" not in found  # "C++" and "C#" must not also produce plain C


def test_case_sensitive_short_names():
    assert "Go" not in names("I go to the gym and want to go far.")
    assert "Go" in names("Wrote microservices in Go and Python.")
    assert "R" not in names("Our R&D team")


def test_nested_matches_prefer_longest():
    found = names("Dashboards in Power BI and apps in React Native.")
    assert "Power BI" in found and "Business Intelligence" not in found
    assert "React Native" in found and "React" not in found


def test_generic_words_are_alias_only():
    found = names("EDUCATION\nPulled sales data for the research office.")
    assert not {"Sales", "Education", "Research"} & found


def test_counts_and_sentences():
    mention = {m.name: m for m in skills.extract_skills("SQL is required. Write SQL daily. Python is a plus.")}
    assert mention["SQL"].count == 2
    assert skills.skill_importance(mention["SQL"]) > skills.skill_importance(mention["Python"])


def test_split_sentences_strips_bullets():
    sents = skills.split_sentences("• Built a dashboard for 6 teams\n- Wrote SQL queries daily\nHi")
    assert sents == ["Built a dashboard for 6 teams", "Wrote SQL queries daily"]
