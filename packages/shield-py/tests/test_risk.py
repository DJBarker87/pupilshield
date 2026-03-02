"""Tests for risk module."""

from shield.risk import analyse_risk


def test_k_threshold_auto_small():
    """k=5 for cohorts < 20."""
    data = [['M', 'No', 'No'] for _ in range(15)]
    result = analyse_risk(data, {
        'quasiIdentifiers': [0, 1, 2],
        'kThreshold': 'auto',
    })
    assert result['kAnonymity']['threshold'] == 5


def test_k_threshold_auto_large():
    """k=3 for cohorts >= 20."""
    data = [['M', 'No', 'No'] for _ in range(22)]
    result = analyse_risk(data, {
        'quasiIdentifiers': [0, 1, 2],
        'kThreshold': 'auto',
    })
    assert result['kAnonymity']['threshold'] == 3


def test_k_anonymity_all_safe():
    """All students in groups >= k."""
    data = [['M', 'No'] for _ in range(10)]
    result = analyse_risk(data, {
        'quasiIdentifiers': [0, 1],
        'kThreshold': 3,
    })
    assert result['kAnonymity']['flaggedGroups'] == []
    assert result['kAnonymity']['safeStudents'] == 10


def test_k_anonymity_flagged():
    """Student with unique attributes should be flagged."""
    data = [
        ['M', 'No'],
        ['M', 'No'],
        ['M', 'No'],
        ['F', 'EHCP'],  # Unique combination
    ]
    result = analyse_risk(data, {
        'quasiIdentifiers': [0, 1],
        'kThreshold': 2,
    })
    assert len(result['kAnonymity']['flaggedGroups']) > 0


def test_rare_categories():
    data = [
        ['M', 'No'],
        ['M', 'No'],
        ['M', 'No'],
        ['F', 'EHCP'],
    ]
    result = analyse_risk(data, {
        'quasiIdentifiers': [0],
        'categoricalColumns': [{'index': 1, 'name': 'SEN'}],
        'kThreshold': 3,
    })
    rare = result['rareCategories']
    assert any(r['value'] == 'EHCP' for r in rare)


def test_generalisation_suggestion():
    data = [
        ['M', 'EHCP'],
        ['M', 'No'],
        ['M', 'No'],
        ['M', 'No'],
    ]
    result = analyse_risk(data, {
        'quasiIdentifiers': [0],
        'categoricalColumns': [{'index': 1, 'name': 'SEN'}],
        'kThreshold': 3,
    })
    rare = result['rareCategories']
    ehcp = next((r for r in rare if r['value'] == 'EHCP'), None)
    assert ehcp is not None
    assert ehcp['suggestion'] is not None  # Should have a generalisation


def test_recommendations_generated():
    data = [['M', 'No'] for _ in range(5)]
    result = analyse_risk(data, {
        'quasiIdentifiers': [0, 1],
        'kThreshold': 3,
    })
    assert len(result['recommendations']) > 0


def test_empty_data():
    result = analyse_risk([], {'quasiIdentifiers': [0]})
    assert result['kAnonymity']['totalStudents'] == 0
