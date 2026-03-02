"""
Mulberry32 seeded PRNG.
Produces identical output to the JavaScript implementation given the same seed.
CRITICAL: All randomness in the library MUST flow through this PRNG.
Never import random.
"""

from typing import Callable, List, TypeVar

T = TypeVar('T')

_MASK = 0xFFFFFFFF


def mulberry32(seed: int) -> Callable[[], float]:
    """Create a Mulberry32 PRNG function.

    Args:
        seed: 32-bit integer seed.

    Returns:
        Function returning floats in [0, 1).
    """
    state = [seed & _MASK]

    def _next() -> float:
        s = (state[0] + 0x6D2B79F5) & _MASK
        state[0] = s
        t = (((s ^ (s >> 15)) * (1 | s))) & _MASK
        t = (t + (((t ^ (t >> 7)) * (61 | t)) & _MASK) ^ t) & _MASK
        return ((t ^ (t >> 14)) & _MASK) / 4294967296

    return _next


def shuffle(array: List[T], prng: Callable[[], float]) -> List[T]:
    """Fisher-Yates in-place shuffle using the seeded PRNG.

    Args:
        array: List to shuffle in place.
        prng: PRNG function returning [0, 1).

    Returns:
        The same list, shuffled in place.
    """
    for i in range(len(array) - 1, 0, -1):
        j = int(prng() * (i + 1))
        array[i], array[j] = array[j], array[i]
    return array
