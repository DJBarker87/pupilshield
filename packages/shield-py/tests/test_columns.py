"""Tests for columns module."""

from shield.columns import detect_columns


def test_detect_name_column():
    headers = ['Name', 'Score']
    rows = [
        ['James Chen', '72'],
        ['Aisha Rahman', '58'],
        ['Connor Murphy', '65'],
    ]
    result = detect_columns(headers, rows)
    name_col = next(c for c in result['columns'] if c['name'] == 'Name')
    assert name_col['type'] == 'name'


def test_detect_numerical_column():
    headers = ['Name', 'Score (%)']
    rows = [
        ['James Chen', '72'],
        ['Aisha Rahman', '58'],
        ['Connor Murphy', '65'],
    ]
    result = detect_columns(headers, rows)
    score_col = next(c for c in result['columns'] if c['name'] == 'Score (%)')
    assert score_col['type'] == 'numerical'


def test_detect_categorical_column():
    headers = ['Name', 'SEN']
    rows = [
        ['James Chen', 'No'],
        ['Aisha Rahman', 'K'],
        ['Connor Murphy', 'No'],
        ['Priya Kapoor', 'No'],
        ['Oliver Thompson', 'EHCP'],
    ]
    result = detect_columns(headers, rows)
    sen_col = next(c for c in result['columns'] if c['name'] == 'SEN')
    assert sen_col['type'] == 'categorical'


def test_detect_sensitive_identifier():
    headers = ['Name', 'UPN', 'DOB']
    rows = [['James Chen', 'A123456789012', '01/01/2010']]
    result = detect_columns(headers, rows)
    upn_col = next(c for c in result['columns'] if c['name'] == 'UPN')
    assert upn_col['type'] == 'identifier'
    assert upn_col['sensitive']
    dob_col = next(c for c in result['columns'] if c['name'] == 'DOB')
    assert dob_col['type'] == 'identifier'
    assert dob_col['sensitive']


def test_review_required_below_threshold():
    headers = ['Name', 'Mixed']
    # Mix of names, numbers, and text — should be below threshold
    rows = [
        ['James Chen', 'Hello'],
        ['Aisha Rahman', '42'],
        ['Connor Murphy', 'World'],
    ]
    result = detect_columns(headers, rows)
    mixed_col = next(c for c in result['columns'] if c['name'] == 'Mixed')
    # Below threshold for any type
    assert mixed_col['reviewRequired']


def test_empty_headers():
    result = detect_columns([], [])
    assert result['columns'] == []


def test_free_text_column():
    headers = ['Name', 'Comments']
    rows = [
        ['James Chen', 'Good effort in class this term, showing great improvement in maths and science subjects'],
        ['Aisha Rahman', 'Needs to work on homework completion rate, frequently missing deadlines for assignments'],
        ['Connor Murphy', 'Excellent contribution to group discussions and collaborative learning activities this week'],
    ]
    result = detect_columns(headers, rows)
    comment_col = next(c for c in result['columns'] if c['name'] == 'Comments')
    assert comment_col['type'] == 'free-text'


def test_mis_categorical_boost():
    headers = ['PP']
    rows = [['Yes'], ['No'], ['No'], ['Yes'], ['No']]
    result = detect_columns(headers, rows)
    pp_col = result['columns'][0]
    assert pp_col['type'] == 'categorical'
