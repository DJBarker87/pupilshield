"""Tests for deanonymiser module."""

from shield.deanonymiser import deanonymise


SAMPLE_MAPPING = {
    'ids': {
        'S01': 'James Chen',
        'S02': 'Aisha Rahman',
    },
    'names': {
        'Faisal Kral': 'James Chen',
        'Irene Kershaw': 'Aisha Rahman',
    },
    'nameToId': {
        'Faisal Kral': 'S01',
        'Irene Kershaw': 'S02',
    },
    'idToFake': {
        'S01': 'Faisal Kral',
        'S02': 'Irene Kershaw',
    },
}


def test_id_first_combined():
    """Replace "FakeName [SXX]" patterns."""
    text = 'Faisal Kral [S01] performed well.'
    result = deanonymise(text, SAMPLE_MAPPING)
    assert 'James Chen' in result['text']
    assert 'Faisal Kral' not in result['text']
    assert result['stats']['idMatches'] >= 1


def test_id_first_standalone_id():
    """Replace standalone [SXX] tokens."""
    text = '[S01] performed well.'
    result = deanonymise(text, SAMPLE_MAPPING)
    assert 'James Chen' in result['text']


def test_id_first_global_fallback():
    """Global fallback replaces remaining fake names."""
    text = 'Faisal Kral did well.'
    result = deanonymise(text, SAMPLE_MAPPING)
    assert 'James Chen' in result['text']
    assert 'Faisal Kral' not in result['text']


def test_case_insensitive():
    """Case-insensitive matching with canonical-case output."""
    text = 'FAISAL KRAL did well.'
    result = deanonymise(text, SAMPLE_MAPPING)
    assert 'James Chen' in result['text']


def test_json_strategy():
    """JSON strategy parses and replaces."""
    import json
    data = json.dumps({'student': '[S01]', 'name': 'Faisal Kral', 'score': 72})
    result = deanonymise(data, SAMPLE_MAPPING, {'strategy': 'json'})
    assert result['valid']
    assert result['parsed']['student'] == 'James Chen'
    assert result['parsed']['name'] == 'James Chen'


def test_json_strategy_fallback():
    """JSON strategy falls back on parse error."""
    text = 'Not valid JSON: Faisal Kral [S01]'
    result = deanonymise(text, SAMPLE_MAPPING, {'strategy': 'json'})
    assert not result['valid']
    assert 'James Chen' in result['text']


def test_structured_only():
    """Structured-only does not do global replacement."""
    text = 'Faisal Kral is doing well.'
    result = deanonymise(text, SAMPLE_MAPPING, {'strategy': 'structured-only'})
    # No ID token or structured pattern, so no replacement via structured-only
    assert 'Faisal Kral' in result['text']
    assert 'Faisal Kral' in result['unmatched']


def test_global_strategy():
    """Global strategy replaces names at word boundaries."""
    text = 'Faisal Kral is doing well.'
    result = deanonymise(text, SAMPLE_MAPPING, {'strategy': 'global'})
    assert 'James Chen' in result['text']


def test_unmatched_tracking():
    """Track fake names that remain unreplaced."""
    text = '[S01] did well.'
    result = deanonymise(text, SAMPLE_MAPPING, {'strategy': 'structured-only'})
    # Irene Kershaw was never mentioned, so should not be in unmatched
    # But check that unmatched only contains names still in text
    for name in result['unmatched']:
        assert name.lower() in result['text'].lower()


def test_structured_table_pass():
    """Replace names in markdown tables."""
    text = """| Student | Score |
|---------|-------|
| Faisal Kral | 72 |
| Irene Kershaw | 58 |"""
    result = deanonymise(text, SAMPLE_MAPPING)
    assert 'James Chen' in result['text']
    assert 'Aisha Rahman' in result['text']


def test_structured_prefix_pass():
    """Replace names in "Student: FakeName" patterns."""
    text = 'Student: Faisal Kral\nScore: 72'
    result = deanonymise(text, SAMPLE_MAPPING)
    assert 'James Chen' in result['text']


def test_possessive():
    """Handle possessives."""
    text = "Faisal Kral's work improved."
    result = deanonymise(text, SAMPLE_MAPPING)
    # The name should be replaced (boundary-aware)
    assert "James Chen" in result['text']


def test_round_trip():
    """anonymise -> deanonymise round-trip."""
    from shield import Shield
    s = Shield(seed=42)
    csv = "Name,Gender,Score\nJames Chen,M,72\nAisha Rahman,F,58"
    anon = s.anonymise(csv)
    # Build some "AI output" using the anonymised names
    first_row_name = anon['anonymised']['rows'][0][0]
    ai_text = f"{first_row_name} showed great improvement."
    deresult = s.deanonymise(ai_text, anon['mapping'])
    # Should contain a real student name
    real_names = ['James Chen', 'Aisha Rahman']
    assert any(name in deresult['text'] for name in real_names)
