"""
Round half away from zero.
CRITICAL: All rounding in the library MUST use this function.
Never use round().
"""

import math


def round_half_away(x: float) -> float:
    """Round half away from zero.

    Args:
        x: Number to round.

    Returns:
        Rounded integer as float.
    """
    return math.copysign(math.floor(abs(x) + 0.5), x)
