"""
Server-only: known identifier column patterns.
Used by strip_identifiers=True mode to auto-remove columns.
"""

import re
from typing import List

# Known identifier patterns for automatic column removal
_IDENTIFIER_PATTERNS = [
    re.compile(r'\bupn\b', re.IGNORECASE),
    re.compile(r'\buln\b', re.IGNORECASE),
    re.compile(r'\bdob\b', re.IGNORECASE),
    re.compile(r'\bdate\s*of\s*birth\b', re.IGNORECASE),
    re.compile(r'\bpostcode\b', re.IGNORECASE),
    re.compile(r'\bemail\b', re.IGNORECASE),
    re.compile(r'\bphone\b', re.IGNORECASE),
    re.compile(r'\bnhs\b', re.IGNORECASE),
    re.compile(r'\baddress\b', re.IGNORECASE),
    re.compile(r'\bcandidate\s*no\b', re.IGNORECASE),
    re.compile(r'\badmission\s*no\b', re.IGNORECASE),
    re.compile(r'\buln\b', re.IGNORECASE),
]


def detect_identifier_columns(headers: List[str]) -> List[int]:
    """Return indices of columns matching known identifier patterns.

    Args:
        headers: List of column header strings.

    Returns:
        List of column indices that are identifier columns.
    """
    indices = []
    for i, header in enumerate(headers):
        if not header:
            continue
        for pattern in _IDENTIFIER_PATTERNS:
            if pattern.search(header):
                indices.append(i)
                break
    return indices
