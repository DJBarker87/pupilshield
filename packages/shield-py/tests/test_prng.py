"""Tests for prng module — PRNG sequence and shuffle."""

import json
from pathlib import Path

from shield.prng import mulberry32, shuffle

FIXTURES_DIR = Path(__file__).parent.parent.parent.parent / 'test-fixtures'


def test_prng_sequence_seed42():
    """First 100 values for seed=42 must match the canonical fixture."""
    with open(FIXTURES_DIR / 'prng-sequence-seed42.json') as f:
        expected = json.load(f)

    prng = mulberry32(42)
    actual = [prng() for _ in range(len(expected))]

    for i, (exp, act) in enumerate(zip(expected, actual)):
        assert act == exp, f"PRNG mismatch at index {i}: expected {exp}, got {act}"


def test_prng_deterministic():
    """Same seed produces same sequence."""
    a = mulberry32(123)
    b = mulberry32(123)
    for _ in range(50):
        assert a() == b()


def test_prng_different_seeds():
    """Different seeds produce different sequences."""
    a = mulberry32(1)
    b = mulberry32(2)
    vals_a = [a() for _ in range(10)]
    vals_b = [b() for _ in range(10)]
    assert vals_a != vals_b


def test_prng_range():
    """All values should be in [0, 1)."""
    prng = mulberry32(42)
    for _ in range(1000):
        v = prng()
        assert 0 <= v < 1, f"Value out of range: {v}"


def test_shuffle_deterministic():
    """Shuffle is deterministic with the same seed."""
    prng1 = mulberry32(42)
    prng2 = mulberry32(42)
    a = list(range(20))
    b = list(range(20))
    shuffle(a, prng1)
    shuffle(b, prng2)
    assert a == b


def test_shuffle_in_place():
    """Shuffle returns the same list object."""
    prng = mulberry32(42)
    lst = [1, 2, 3, 4, 5]
    result = shuffle(lst, prng)
    assert result is lst


def test_shuffle_preserves_elements():
    """Shuffle preserves all elements."""
    prng = mulberry32(42)
    lst = list(range(100))
    shuffle(lst, prng)
    assert sorted(lst) == list(range(100))
