"""
Name anonymisation: replacement, ID token generation, row shuffling.
Pure functions, stdlib only.
"""

import json
import re
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from .prng import shuffle as prng_shuffle

# Load name bank
_DATA_DIR = Path(__file__).parent / 'data'
with open(_DATA_DIR / 'names.json', 'r', encoding='utf-8') as _f:
    _names = json.load(_f)


def build_blocked_tokens(
    rows: List[List[str]],
    name_col_index: int,
    flags: Optional[List[Any]] = None,
    staff_names: Optional[List[str]] = None,
) -> Set[str]:
    """Build a set of blocked tokens from student names, flags, and staff names.

    All tokens are lowercased for case-insensitive matching.

    Args:
        rows: Data rows (no header).
        name_col_index: Index of the name column.
        flags: Flagged tokens from scanner.
        staff_names: Staff names to block.

    Returns:
        Set of blocked tokens (lowercased).
    """
    blocked: Set[str] = set()

    # Add all real student first names and surnames individually
    for row in rows:
        full_name = row[name_col_index]
        if not isinstance(full_name, str):
            continue
        parts = full_name.strip().split()
        for part in parts:
            if len(part) > 0:
                blocked.add(part.lower())

    # Add all flagged tokens
    if flags:
        for flag in flags:
            if isinstance(flag, str):
                token = flag
            elif isinstance(flag, dict):
                token = flag.get('value') or flag.get('token')
            else:
                token = None
            if token:
                blocked.add(token.lower())

    # Add all staff names (split into individual parts)
    if staff_names:
        for name in staff_names:
            parts = name.strip().split()
            for part in parts:
                if len(part) > 0:
                    blocked.add(part.lower())

    return blocked


def _select_name(
    name_list: List[str],
    blocked_tokens: Set[str],
    used_names: Set[str],
    prng: Callable[[], float],
) -> str:
    """Select a name from a name list using the PRNG, avoiding blocked tokens.

    Consumes one PRNG call per attempt.

    Args:
        name_list: Array of names to choose from.
        blocked_tokens: Tokens to avoid (lowercased).
        used_names: Already-used names to avoid reuse (lowercased).
        prng: PRNG function.

    Returns:
        Selected name.

    Raises:
        RuntimeError: If name bank is exhausted.
    """
    max_attempts = len(name_list) * 3
    for _ in range(max_attempts):
        index = int(prng() * len(name_list))
        name = name_list[index]
        name_lower = name.lower()
        if name_lower not in blocked_tokens and name_lower not in used_names:
            return name

    # Fallback: exhaustive search
    for name in name_list:
        name_lower = name.lower()
        if name_lower not in blocked_tokens and name_lower not in used_names:
            return name

    raise RuntimeError('Unable to find a non-blocked, unused name. Name bank exhausted.')


def _get_first_name_list(
    gender: Optional[str],
    gender_mode: str,
) -> List[str]:
    """Determine which first-name list to use based on gender.

    Args:
        gender: Gender value from the row.
        gender_mode: 'aware' or 'neutral'.

    Returns:
        List of first names to choose from.
    """
    if gender_mode == 'neutral':
        return _names['neutral']

    if gender:
        g = gender.lower().strip()
        if g in ('m', 'male'):
            return _names['male']
        if g in ('f', 'female'):
            return _names['female']
        if g in ('x', 'non-binary', 'nonbinary', 'other'):
            return _names['neutral']

    # Default: combine all lists
    return _names['male'] + _names['female'] + _names['neutral']


def anonymise_names(
    rows: List[List[str]],
    name_col_index: int,
    prng: Callable[[], float],
    options: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Anonymise names in data rows, replacing real names with fake names and ID tokens.

    PRNG consumption order: one call for first name index, one for surname index, per student.

    Args:
        rows: Data rows (no header).
        name_col_index: Index of the name column.
        prng: PRNG function.
        options: Options dict with gender_col_index, gender_mode, blocked_tokens.

    Returns:
        Dict with 'rows' (anonymised) and 'mapping'.
    """
    if options is None:
        options = {}

    gender_col_index = options.get('gender_col_index')
    gender_mode = options.get('gender_mode', 'aware')
    blocked_tokens: Set[str] = options.get('blocked_tokens', set())

    mapping = {
        'ids': {},
        'names': {},
        'nameToId': {},
        'idToFake': {},
    }

    used_first_names: Set[str] = set()
    used_surnames: Set[str] = set()
    new_rows = []

    for i, row in enumerate(rows):
        row = list(row)  # Copy
        real_name = row[name_col_index]
        id_num = i + 1
        id_str = f'0{id_num}' if id_num < 10 else str(id_num)
        id_token = f'S{id_str}'

        # Determine gender for name selection
        gender = row[gender_col_index] if gender_col_index is not None else None
        first_name_list = _get_first_name_list(gender, gender_mode)

        # Select first name (one PRNG call)
        first_name = _select_name(first_name_list, blocked_tokens, used_first_names, prng)
        used_first_names.add(first_name.lower())

        # Select surname (one PRNG call)
        surname = _select_name(_names['surnames'], blocked_tokens, used_surnames, prng)
        used_surnames.add(surname.lower())

        fake_name = f'{first_name} {surname}'

        # Store mapping
        mapping['ids'][id_token] = real_name
        mapping['names'][fake_name] = real_name
        mapping['nameToId'][fake_name] = id_token
        mapping['idToFake'][id_token] = fake_name

        # Replace name column with "FakeName [SXX]" format
        row[name_col_index] = f'{fake_name} [{id_token}]'
        new_rows.append(row)

    return {'rows': new_rows, 'mapping': mapping}


def shuffle_rows(
    rows: List[List[Any]],
    prng: Callable[[], float],
) -> List[List[Any]]:
    """Shuffle rows using Fisher-Yates algorithm with the seeded PRNG.

    Returns a new list (does not mutate the input).

    Args:
        rows: Rows to shuffle.
        prng: PRNG function.

    Returns:
        New list with rows in shuffled order.
    """
    copy = list(rows)
    prng_shuffle(copy, prng)
    return copy
