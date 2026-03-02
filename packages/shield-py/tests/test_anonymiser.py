"""Tests for anonymiser module."""

from shield.prng import mulberry32
from shield.anonymiser import build_blocked_tokens, anonymise_names, shuffle_rows


def test_build_blocked_tokens_from_names():
    rows = [['James Chen', 'M'], ['Aisha Rahman', 'F']]
    blocked = build_blocked_tokens(rows, 0)
    assert 'james' in blocked
    assert 'chen' in blocked
    assert 'aisha' in blocked
    assert 'rahman' in blocked


def test_build_blocked_tokens_with_flags():
    rows = [['James Chen', 'M']]
    blocked = build_blocked_tokens(rows, 0, flags=['Emily', {'value': 'hospital'}])
    assert 'emily' in blocked
    assert 'hospital' in blocked


def test_build_blocked_tokens_with_staff():
    rows = [['James Chen', 'M']]
    blocked = build_blocked_tokens(rows, 0, staff_names=['Mrs Patel'])
    assert 'mrs' in blocked
    assert 'patel' in blocked


def test_anonymise_names_deterministic():
    prng = mulberry32(42)
    rows = [
        ['James Chen', 'M', 'No'],
        ['Aisha Rahman', 'F', 'K'],
    ]
    result = anonymise_names(rows, 0, prng, {'gender_col_index': 1})
    mapping = result['mapping']

    assert mapping['ids']['S01'] == 'James Chen'
    assert mapping['ids']['S02'] == 'Aisha Rahman'
    assert len(mapping['names']) == 2
    assert len(mapping['nameToId']) == 2
    assert len(mapping['idToFake']) == 2

    # All rows should have [SXX] format
    for row in result['rows']:
        assert '[S' in row[0]


def test_anonymise_names_id_format():
    prng = mulberry32(42)
    rows = [['Student ' + str(i), 'M'] for i in range(12)]
    result = anonymise_names(rows, 0, prng)
    # First 9 should be S01-S09, then S10+
    assert '[S01]' in result['rows'][0][0]
    assert '[S09]' in result['rows'][8][0]
    assert '[S10]' in result['rows'][9][0]
    assert '[S12]' in result['rows'][11][0]


def test_anonymise_names_blocked_collision():
    prng = mulberry32(42)
    rows = [['Test Person', 'M']]
    # Block some tokens
    blocked = {'test', 'person'}
    result = anonymise_names(rows, 0, prng, {'blocked_tokens': blocked})
    fake_name = list(result['mapping']['names'].keys())[0]
    # Fake name should not contain blocked tokens
    for part in fake_name.lower().split():
        assert part not in blocked


def test_anonymise_names_gender_neutral():
    prng = mulberry32(42)
    rows = [['Student A', 'M']]
    result = anonymise_names(rows, 0, prng, {
        'gender_col_index': 1,
        'gender_mode': 'neutral',
    })
    # Should succeed
    assert len(result['mapping']['names']) == 1


def test_shuffle_rows_preserves_elements():
    prng = mulberry32(42)
    rows = [[str(i)] for i in range(10)]
    shuffled = shuffle_rows(rows, prng)
    assert sorted([r[0] for r in shuffled]) == sorted([r[0] for r in rows])
    assert len(shuffled) == len(rows)


def test_shuffle_rows_does_not_mutate_input():
    prng = mulberry32(42)
    rows = [[str(i)] for i in range(10)]
    original = [list(r) for r in rows]
    shuffle_rows(rows, prng)
    assert rows == original
