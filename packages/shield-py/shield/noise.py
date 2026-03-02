"""
Bounded Laplace noise engine with grade-boundary awareness.
Pure functions, stdlib only.
"""

import math
from typing import Any, Callable, Dict, List, Optional, Union

from .rounding import round_half_away


def laplace(mu: float, b: float, prng: Callable[[], float]) -> float:
    """Draw a single sample from the Laplace distribution.

    Formula: mu - b * sign(u) * ln(1 - 2 * |u|) where u = prng() - 0.5

    Args:
        mu: Location parameter (centre).
        b: Scale parameter (spread).
        prng: Seeded PRNG returning [0, 1).

    Returns:
        A Laplace-distributed sample.
    """
    u = prng() - 0.5
    if u == 0:
        return mu
    return mu - b * math.copysign(1, u) * math.log(1 - 2 * abs(u))


def get_band(
    value: float,
    boundaries: List[float],
    max_value: float,
) -> Dict[str, float]:
    """Find the [lower, upper) band that a value falls into.

    Bands are [lower inclusive, upper exclusive).
    A value exactly on a boundary belongs to the band starting at that boundary.

    Args:
        value: The value to classify.
        boundaries: Sorted ascending boundary values.
        max_value: Maximum possible value.

    Returns:
        Dict with 'lower' and 'upper' keys.
    """
    lower = 0
    for i in range(len(boundaries)):
        if value < boundaries[i]:
            return {'lower': lower, 'upper': boundaries[i]}
        lower = boundaries[i]
    # Value is in the last band
    return {'lower': lower, 'upper': max_value + 1}


def add_bounded_noise(
    value: float,
    max_value: float,
    noise_percent: float,
    grade_boundaries: Optional[List[float]],
    prng: Callable[[], float],
) -> Dict[str, Any]:
    """Add bounded Laplace noise to a single value, respecting grade boundaries.

    Args:
        value: Original numeric value.
        max_value: Maximum possible value in the scale.
        noise_percent: Noise as a fraction of max_value (e.g. 0.05 for 5%).
        grade_boundaries: Sorted boundary array, or None.
        prng: Seeded PRNG.

    Returns:
        Dict with 'value' (noised) and 'failed' (bool).
    """
    max_noise = max_value * noise_percent
    b = max_noise / 2

    # Draw from Laplace centred on original value
    noised = laplace(value, b, prng)

    # Clamp to +/- max_noise from original
    noised = max(value - max_noise, min(value + max_noise, noised))

    if grade_boundaries and len(grade_boundaries) > 0:
        band = get_band(value, grade_boundaries, max_value)

        # Compute integer range within the band
        int_min = math.ceil(band['lower'])
        int_max = int(band['upper'] - 1)

        # Narrow-band guard: only 1 possible integer value
        if int_max - int_min < 1:
            return {'value': value, 'failed': True}

        # Round and clamp within band
        noised = round_half_away(noised)
        noised = max(int_min, min(int_max, noised))

        return {'value': noised, 'failed': False}

    # No grade boundaries: round and clamp to [0, max_value]
    noised = round_half_away(noised)
    noised = max(0, min(max_value, noised))

    return {'value': noised, 'failed': False}


def add_noise_to_column(
    values: List[Union[float, int, str]],
    max_value: float,
    noise_percent: float,
    grade_boundaries: Optional[List[float]],
    prng: Callable[[], float],
) -> Dict[str, Any]:
    """Add noise to an entire column of values.

    Non-numeric values (strings like "Absent") are passed through unchanged.

    Args:
        values: Column values.
        max_value: Maximum possible value in the scale.
        noise_percent: Noise fraction (e.g. 0.05).
        grade_boundaries: Grade boundary array or None.
        prng: Seeded PRNG.

    Returns:
        Dict with 'values' and 'perturbation_failures' count.
    """
    result = []
    perturbation_failures = 0

    for v in values:
        if not isinstance(v, (int, float)) or not math.isfinite(v):
            result.append(v)
            continue

        outcome = add_bounded_noise(v, max_value, noise_percent, grade_boundaries, prng)
        result.append(outcome['value'])
        if outcome['failed']:
            perturbation_failures += 1

    return {'values': result, 'perturbation_failures': perturbation_failures}
