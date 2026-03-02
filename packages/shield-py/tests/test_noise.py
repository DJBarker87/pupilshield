"""Tests for noise module."""

import math

from shield.prng import mulberry32
from shield.noise import laplace, get_band, add_bounded_noise, add_noise_to_column


def test_laplace_deterministic():
    prng = mulberry32(42)
    result = laplace(50, 2.5, prng)
    # Should be deterministic
    prng2 = mulberry32(42)
    result2 = laplace(50, 2.5, prng2)
    assert result == result2


def test_laplace_centre():
    """When u=0, result is mu."""
    # Can't easily force u=0, but we can test mu=0
    prng = mulberry32(42)
    result = laplace(0, 1, prng)
    assert isinstance(result, float)


def test_get_band_first():
    band = get_band(30, [40, 50, 60, 70, 80], 100)
    assert band == {'lower': 0, 'upper': 40}


def test_get_band_middle():
    band = get_band(55, [40, 50, 60, 70, 80], 100)
    assert band == {'lower': 50, 'upper': 60}


def test_get_band_exact_boundary():
    """Value on boundary belongs to the band starting at that boundary."""
    band = get_band(40, [40, 50, 60, 70, 80], 100)
    assert band == {'lower': 40, 'upper': 50}


def test_get_band_last():
    band = get_band(85, [40, 50, 60, 70, 80], 100)
    assert band == {'lower': 80, 'upper': 101}


def test_bounded_noise_with_boundaries():
    prng = mulberry32(42)
    result = add_bounded_noise(55, 100, 0.05, [40, 50, 60, 70, 80], prng)
    assert not result['failed']
    # Should stay within the 50-59 band
    assert 50 <= result['value'] <= 59


def test_bounded_noise_without_boundaries():
    prng = mulberry32(42)
    result = add_bounded_noise(50, 100, 0.05, None, prng)
    assert not result['failed']
    assert 0 <= result['value'] <= 100


def test_narrow_band_guard():
    """Narrow band (only 1 integer) returns original + failed."""
    prng = mulberry32(42)
    # Create a boundary that leaves only one integer
    result = add_bounded_noise(5, 100, 0.05, [5, 6], prng)
    # Band is [5, 6), intMin=5, intMax=5, so intMax-intMin < 1
    assert result['failed']
    assert result['value'] == 5


def test_noise_column():
    prng = mulberry32(42)
    values = [72.0, 58.0, 65.0, 78.0]
    result = add_noise_to_column(values, 100, 0.05, [40, 50, 60, 70, 80], prng)
    assert len(result['values']) == 4
    # All should be integers (rounded)
    for v in result['values']:
        assert v == int(v)


def test_noise_column_passthrough_strings():
    prng = mulberry32(42)
    values = [72.0, 'Absent', 65.0]
    result = add_noise_to_column(values, 100, 0.05, None, prng)
    assert result['values'][1] == 'Absent'


def test_grade_boundary_respect():
    """Over 1000 applications, noised value never crosses grade boundary."""
    prng = mulberry32(42)
    boundaries = [40, 50, 60, 70, 80, 90]
    for _ in range(1000):
        original = 55  # In the 50-59 band
        result = add_bounded_noise(original, 100, 0.05, boundaries, prng)
        if not result['failed']:
            assert 50 <= result['value'] <= 59, f"Value {result['value']} crossed boundary"
