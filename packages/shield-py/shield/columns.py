"""
Column type detection heuristics for UK school data exports.
Pure functions, stdlib only.
"""

import math
import re
from typing import Any, Dict, List, Optional, Tuple


# Headers that indicate an always-sensitive identifier column
_SENSITIVE_PATTERNS = [
    (re.compile(r'\bupn\b', re.IGNORECASE), 'UPN'),
    (re.compile(r'\buln\b', re.IGNORECASE), 'ULN'),
    (re.compile(r'\bdob\b', re.IGNORECASE), 'DOB'),
    (re.compile(r'\bdate\s*of\s*birth\b', re.IGNORECASE), 'DOB'),
    (re.compile(r'\bpostcode\b', re.IGNORECASE), 'postcode'),
    (re.compile(r'\bemail\b', re.IGNORECASE), 'email'),
    (re.compile(r'\bphone\b', re.IGNORECASE), 'phone'),
    (re.compile(r'\bnhs\b', re.IGNORECASE), 'NHS'),
    (re.compile(r'\baddress\b', re.IGNORECASE), 'address'),
    (re.compile(r'\bcandidate\s*no\b', re.IGNORECASE), 'candidate number'),
    (re.compile(r'\badmission\s*no\b', re.IGNORECASE), 'admission number'),
]

# UK MIS column header patterns that boost categorical classification
_MIS_CATEGORICAL_PATTERNS = [
    re.compile(r'\bform\b', re.IGNORECASE),
    re.compile(r'\bhouse\b', re.IGNORECASE),
    re.compile(r'\bset\b', re.IGNORECASE),
    re.compile(r'\bks2\b', re.IGNORECASE),
    re.compile(r'\bfft\b', re.IGNORECASE),
    re.compile(r'\bcat\b', re.IGNORECASE),
    re.compile(r'\bpp\b', re.IGNORECASE),
    re.compile(r'\bsen\b', re.IGNORECASE),
    re.compile(r'\beal\b', re.IGNORECASE),
    re.compile(r'\blac\b', re.IGNORECASE),
    re.compile(r'\battendance\b', re.IGNORECASE),
    re.compile(r'\bteacher\b', re.IGNORECASE),
    re.compile(r'\btutor\b', re.IGNORECASE),
    re.compile(r'\byear\b', re.IGNORECASE),
    re.compile(r'\bclass\b', re.IGNORECASE),
]

# Confidence thresholds per type
_THRESHOLDS = {
    'name': 0.90,
    'free-text': 0.85,
    'date': 0.80,
    'numerical': 0.75,
    'categorical': 0.75,
}

# Non-numeric exception values
_NUMERIC_EXCEPTIONS = {'absent', 'n/a', 'x', '-', ''}

# Header keywords that boost specific type classifications
_HEADER_BOOSTS = {
    'name': [re.compile(r'\bname\b', re.IGNORECASE), re.compile(r'\bstudent\b', re.IGNORECASE), re.compile(r'\bpupil\b', re.IGNORECASE)],
    'numerical': [re.compile(r'\bscore\b', re.IGNORECASE), re.compile(r'\bmark\b', re.IGNORECASE), re.compile(r'\bpercent\b', re.IGNORECASE), re.compile(r'\battendance\b', re.IGNORECASE), re.compile(r'\bgrade\b', re.IGNORECASE)],
    'free-text': [re.compile(r'\bcomment\b', re.IGNORECASE), re.compile(r'\bnote\b', re.IGNORECASE), re.compile(r'\bremark\b', re.IGNORECASE)],
    'date': [re.compile(r'\bdate\b', re.IGNORECASE), re.compile(r'\bdob\b', re.IGNORECASE), re.compile(r'\bbirth\b', re.IGNORECASE)],
}

_HEADER_BOOST_AMOUNT = 0.10


def _check_sensitive(header: str) -> Tuple[bool, Optional[str]]:
    """Check whether a header matches any always-sensitive identifier pattern."""
    for pattern, label in _SENSITIVE_PATTERNS:
        if pattern.search(header):
            return True, label
    return False, None


def _is_mis_categorical(header: str) -> bool:
    """Check whether a header matches any UK MIS categorical pattern."""
    return any(p.search(header) for p in _MIS_CATEGORICAL_PATTERNS)


def _has_header_boost(header: str, col_type: str) -> bool:
    """Check whether a header matches boosts for a given type."""
    patterns = _HEADER_BOOSTS.get(col_type)
    if not patterns:
        return False
    return any(p.search(header) for p in patterns)


def _looks_like_name(val: str) -> bool:
    """Test whether a value looks like a name."""
    trimmed = val.strip()
    if len(trimmed) < 3:
        return False
    if len(trimmed) > 50:
        return False

    # Strip commas for word counting
    normalised = trimmed.replace(',', '')
    words = normalised.strip().split()
    if len(words) < 2 or len(words) > 4:
        return False

    for word in words:
        # Remove leading/trailing punctuation
        cleaned = re.sub(r"^[.\-']+|[.\-']+$", '', word)
        if len(cleaned) < 1:
            return False
        if not re.match(r"^[A-Za-z][A-Za-z'\-]*[A-Za-z]$", cleaned) and not re.match(r'^[A-Za-z]$', cleaned):
            return False

    # Reject code-like formats: all words too short
    all_short = all(len(re.sub(r'[^A-Za-z]', '', w)) <= 2 for w in words)
    if all_short:
        return False

    return True


def _looks_like_number(val: str) -> Dict[str, bool]:
    """Test whether a value looks like a number."""
    trimmed = val.strip()
    if trimmed == '':
        return {'isNumeric': False, 'isException': True}

    if trimmed.lower() in _NUMERIC_EXCEPTIONS:
        return {'isNumeric': False, 'isException': True}

    # Try parsing as number
    try:
        num = float(trimmed)
        if math.isfinite(num):
            return {'isNumeric': True, 'isException': False}
    except ValueError:
        pass

    # Allow percentage strings like "85%"
    if re.match(r'^\d+(\.\d+)?%$', trimmed):
        return {'isNumeric': True, 'isException': False}

    return {'isNumeric': False, 'isException': False}


def _looks_like_date(val: str) -> bool:
    """Test whether a value matches a date pattern."""
    trimmed = val.strip()
    if re.match(r'^\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}$', trimmed):
        return True
    if re.match(r'^\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2}$', trimmed):
        return True
    if re.search(r'\b\d{1,2}[\s\-][A-Za-z]{3,9}[\s\-,]\s*\d{2,4}\b', trimmed):
        return True
    if re.search(r'\b[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}\b', trimmed):
        return True
    return False


def _classify_column(
    header: str,
    values: List[str],
    total_rows: int,
) -> Dict[str, Any]:
    """Classify a single column by analysing header and cell values."""
    if not values:
        return {'type': 'categorical', 'confidence': 0}

    non_empty = [v for v in values if v.strip() != '']
    if not non_empty:
        return {'type': 'categorical', 'confidence': 0}

    count = len(non_empty)

    # Name score
    name_matches = sum(1 for v in non_empty if _looks_like_name(v))
    name_conf = name_matches / count
    if _has_header_boost(header, 'name'):
        name_conf = min(1, name_conf + _HEADER_BOOST_AMOUNT)

    # Date score
    date_matches = sum(1 for v in non_empty if _looks_like_date(v))
    date_conf = date_matches / count
    if _has_header_boost(header, 'date'):
        date_conf = min(1, date_conf + _HEADER_BOOST_AMOUNT)

    # Numerical score
    numeric_matches = 0
    numeric_exceptions = 0
    for v in non_empty:
        result = _looks_like_number(v)
        if result['isNumeric']:
            numeric_matches += 1
        elif result['isException']:
            numeric_exceptions += 1
    num_conf = (numeric_matches + numeric_exceptions) / count if numeric_matches > 0 else 0
    if _has_header_boost(header, 'numerical'):
        num_conf = min(1, num_conf + _HEADER_BOOST_AMOUNT)

    # Categorical score
    unique_values = set(v.strip().lower() for v in non_empty)
    unique_ratio = len(unique_values) / count
    avg_len = sum(len(v.strip()) for v in non_empty) / count

    cat_conf = 0.0
    if unique_ratio < 0.3 and avg_len < 20:
        cat_conf = 1 - unique_ratio
    elif unique_ratio < 0.5 and avg_len < 20:
        cat_conf = 0.5
    if _is_mis_categorical(header):
        cat_conf = min(1, cat_conf + _HEADER_BOOST_AMOUNT + 0.15)

    # Free-text score
    ft_conf = 0.0
    if avg_len > 30 and unique_ratio > 0.7:
        ft_conf = min(1, unique_ratio * (1 if avg_len > 50 else 0.9))
    elif avg_len > 20 and unique_ratio > 0.5:
        ft_conf = 0.5
    if _has_header_boost(header, 'free-text'):
        ft_conf = min(1, ft_conf + _HEADER_BOOST_AMOUNT)

    # Priority-based selection
    candidates = [
        {'type': 'name', 'confidence': name_conf},
        {'type': 'date', 'confidence': date_conf},
        {'type': 'numerical', 'confidence': num_conf},
        {'type': 'categorical', 'confidence': cat_conf},
        {'type': 'free-text', 'confidence': ft_conf},
    ]

    # Filter to candidates that meet their threshold
    passing = [c for c in candidates if c['confidence'] >= _THRESHOLDS.get(c['type'], 0.75)]

    if passing:
        return {'type': passing[0]['type'], 'confidence': passing[0]['confidence']}

    # Nothing passes — pick best confidence
    candidates.sort(key=lambda c: c['confidence'], reverse=True)
    best = candidates[0]
    if best['confidence'] == 0:
        return {'type': 'categorical', 'confidence': 0}
    return {'type': best['type'], 'confidence': best['confidence']}


def detect_columns(
    headers: List[str],
    rows: List[List[str]],
) -> Dict[str, Any]:
    """Detect column types for a tabular dataset.

    Args:
        headers: Array of column header strings.
        rows: Array of row arrays (strings), no header row.

    Returns:
        Dict with 'columns' list.
    """
    if not headers:
        return {'columns': []}

    total_rows = len(rows) if rows else 0
    columns = []

    for i, header in enumerate(headers):
        header = header or ''
        values = [str(row[i]) if i < len(row) and row[i] is not None else '' for row in (rows or [])]

        # Check always-sensitive identifiers first
        sensitive, label = _check_sensitive(header)

        # Classify the column content
        classification = _classify_column(header, values, total_rows)
        detected_type = classification['type']
        confidence = classification['confidence']

        # If the column is a sensitive identifier, override type
        col_type = 'identifier' if sensitive else detected_type

        # Determine review requirement
        threshold = _THRESHOLDS.get(col_type, 0.75)
        review_required = not sensitive and confidence < threshold

        columns.append({
            'index': i,
            'name': header,
            'type': col_type,
            'confidence': math.floor(confidence * 100 + 0.5) / 100,
            'sensitive': sensitive,
            'reviewRequired': review_required,
        })

    return {'columns': columns}
