"""
Free-text scanning for names, keywords, and sensitive patterns.
Pure functions, stdlib only.
"""

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

# Load keywords
_DATA_DIR = Path(__file__).parent / 'data'
with open(_DATA_DIR / 'keywords.json', 'r', encoding='utf-8') as _f:
    _keywords_data = json.load(_f)


def _extract_context(text: str, start: int, end: int) -> str:
    """Extract ~30 characters of context around a match."""
    pad = 15
    ctx_start = max(0, start - pad)
    ctx_end = min(len(text), end + pad)
    ctx = ''
    if ctx_start > 0:
        ctx += '...'
    ctx += text[ctx_start:ctx_end]
    if ctx_end < len(text):
        ctx += '...'
    return ctx


def _build_word_boundary_regex(phrase: str) -> re.Pattern:
    """Build a word-boundary-aware, case-insensitive regex for a phrase."""
    escaped = re.escape(phrase)
    return re.compile(r'\b' + escaped + r'\b', re.IGNORECASE)


def _scan_names(
    text: str,
    known_names: List[str],
    staff_names: List[str],
) -> List[Dict[str, Any]]:
    """Scan text for known names from a class list."""
    flags = []
    all_names = list(known_names or []) + list(staff_names or [])

    # Collect all name parts to search for
    name_parts = []
    for full_name in all_names:
        trimmed = full_name.strip()
        parts = trimmed.split()
        name_parts.append({'pattern': trimmed, 'original': trimmed})
        for part in parts:
            if len(part) >= 2:
                name_parts.append({'pattern': part, 'original': part})

    # Deduplicate by lowercase pattern
    seen = set()
    unique_parts = []
    for np in name_parts:
        key = np['pattern'].lower()
        if key not in seen:
            seen.add(key)
            unique_parts.append(np)

    # Sort longest first
    unique_parts.sort(key=lambda x: len(x['pattern']), reverse=True)

    # Track matched positions to avoid duplicates
    matched_ranges = []

    for item in unique_parts:
        pattern = item['pattern']
        regex = _build_word_boundary_regex(pattern)
        for match in regex.finditer(text):
            pos = match.start()
            match_end = match.end()

            # Check overlap with existing matches
            is_duplicate = False
            for e_start, e_end in matched_ranges:
                if pos >= e_start and match_end <= e_end:
                    is_duplicate = True
                    break

            if not is_duplicate:
                matched_ranges.append((pos, match_end))
                flags.append({
                    'type': 'name',
                    'value': match.group(0),
                    'position': pos,
                    'context': _extract_context(text, pos, match_end),
                })

    return flags


def _scan_keywords(
    text: str,
    keywords: Dict[str, List[str]],
) -> List[Dict[str, Any]]:
    """Scan text for keywords from the keyword lists."""
    flags = []
    categories = ['medical', 'safeguarding', 'family']

    for category in categories:
        terms = keywords.get(category)
        if not terms or not isinstance(terms, list):
            continue

        # Sort longest first
        sorted_terms = sorted(terms, key=len, reverse=True)

        for term in sorted_terms:
            regex = _build_word_boundary_regex(term)
            for match in regex.finditer(text):
                pos = match.start()
                match_end = match.end()
                flags.append({
                    'type': 'keyword',
                    'subtype': category,
                    'value': match.group(0),
                    'position': pos,
                    'context': _extract_context(text, pos, match_end),
                })

    return flags


def _scan_dates(text: str) -> List[Dict[str, Any]]:
    """Scan text for date patterns (UK formats)."""
    flags = []
    date_regex = re.compile(r'\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b')
    for match in date_regex.finditer(text):
        pos = match.start()
        match_end = match.end()
        flags.append({
            'type': 'date',
            'value': match.group(0),
            'position': pos,
            'context': _extract_context(text, pos, match_end),
        })
    return flags


def _scan_postcodes(text: str) -> List[Dict[str, Any]]:
    """Scan text for UK postcodes."""
    flags = []
    postcode_regex = re.compile(r'\b([A-Za-z]{1,2}\d[A-Za-z\d]?)\s*(\d[A-Za-z]{2})\b')
    for match in postcode_regex.finditer(text):
        pos = match.start()
        match_end = match.end()
        flags.append({
            'type': 'postcode',
            'value': match.group(0),
            'position': pos,
            'context': _extract_context(text, pos, match_end),
        })
    return flags


def _scan_phones(text: str) -> List[Dict[str, Any]]:
    """Scan text for UK phone numbers."""
    flags = []
    phone_regex = re.compile(
        r'(?:\+44\s?\d[\d\s]{8,12}'
        r'|(?:\b0[1-27]\d{2,3}\s?\d{3,4}\s?\d{3,4}\b)'
        r'|\b07\d{3}\s?\d{3}\s?\d{3}\b'
        r'|\b07\d{9}\b'
        r'|\b01\d{8,9}\b'
        r'|\b02\d{9}\b)'
    )
    for match in phone_regex.finditer(text):
        pos = match.start()
        match_end = match.end()
        flags.append({
            'type': 'phone',
            'value': match.group(0),
            'position': pos,
            'context': _extract_context(text, pos, match_end),
        })
    return flags


def _scan_emails(text: str) -> List[Dict[str, Any]]:
    """Scan text for email addresses."""
    flags = []
    email_regex = re.compile(r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b')
    for match in email_regex.finditer(text):
        pos = match.start()
        match_end = match.end()
        flags.append({
            'type': 'email',
            'value': match.group(0),
            'position': pos,
            'context': _extract_context(text, pos, match_end),
        })
    return flags


def _scan_extra_patterns(
    text: str,
    extra_patterns: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Scan text for extra user-supplied regex patterns."""
    flags = []
    if not extra_patterns:
        return flags

    for item in extra_patterns:
        pattern = item.get('pattern', '')
        flag_type = item.get('type', 'custom')
        if isinstance(pattern, re.Pattern):
            regex = re.compile(pattern.pattern, re.IGNORECASE)
        else:
            regex = re.compile(pattern, re.IGNORECASE)
        for match in regex.finditer(text):
            pos = match.start()
            match_end = match.end()
            flags.append({
                'type': flag_type,
                'value': match.group(0),
                'position': pos,
                'context': _extract_context(text, pos, match_end),
            })

    return flags


def _deduplicate_flags(flags: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Remove duplicate flags at the same position with the same type."""
    sorted_flags = sorted(flags, key=lambda f: (f['position'], -len(f['value'])))

    result = []
    seen = set()

    for flag in sorted_flags:
        key = f"{flag['position']}:{flag['type']}:{flag.get('subtype', '')}"
        if key not in seen:
            seen.add(key)
            result.append(flag)

    return result


def _get_redaction_label(flag: Dict[str, Any]) -> str:
    """Get the redaction label for a flag type."""
    flag_type = flag['type']
    if flag_type == 'name':
        return '[REDACTED NAME]'
    if flag_type == 'keyword':
        subtype = flag.get('subtype', '')
        if subtype == 'medical':
            return '[ADDITIONAL NEEDS]'
        if subtype == 'safeguarding':
            return '[REDACTED]'
        if subtype == 'family':
            return '[PARENT/GUARDIAN]'
        return '[REDACTED]'
    if flag_type == 'date':
        return '[REDACTED DATE]'
    if flag_type == 'postcode':
        return '[REDACTED POSTCODE]'
    if flag_type == 'phone':
        return '[REDACTED PHONE]'
    if flag_type == 'email':
        return '[REDACTED EMAIL]'
    return '[REDACTED]'


def _build_cleaned_text(text: str, flags: List[Dict[str, Any]]) -> str:
    """Build cleaned text with all flagged items replaced by redaction placeholders."""
    if not flags:
        return text

    # Work backwards to preserve position indices
    result = text
    sorted_flags = sorted(flags, key=lambda f: f['position'], reverse=True)

    for flag in sorted_flags:
        label = _get_redaction_label(flag)
        pos = flag['position']
        end = pos + len(flag['value'])
        result = result[:pos] + label + result[end:]

    return result


def scan_text(
    text: str,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Scan free text for sensitive information.

    Args:
        text: The text to scan.
        config: Configuration with known_names, staff_names, keywords, extra_patterns.

    Returns:
        Dict with 'flags' and 'cleaned'.
    """
    if not isinstance(text, str) or len(text) == 0:
        return {'flags': [], 'cleaned': text or ''}

    if config is None:
        config = {}

    known_names = config.get('knownNames', config.get('known_names', []))
    staff_names = config.get('staffNames', config.get('staff_names', []))
    keywords = config.get('keywords', 'default')
    extra_patterns = config.get('extraPatterns', config.get('extra_patterns', []))

    # Resolve keywords
    resolved_keywords = _keywords_data if keywords == 'default' else keywords

    # Run all scanners
    all_flags = []
    all_flags.extend(_scan_names(text, known_names, staff_names))
    all_flags.extend(_scan_keywords(text, resolved_keywords))
    all_flags.extend(_scan_dates(text))
    all_flags.extend(_scan_postcodes(text))
    all_flags.extend(_scan_phones(text))
    all_flags.extend(_scan_emails(text))
    all_flags.extend(_scan_extra_patterns(text, extra_patterns))

    # Deduplicate and sort by position
    deduplicated = _deduplicate_flags(all_flags)
    deduplicated.sort(key=lambda f: f['position'])

    # Build cleaned text
    cleaned = _build_cleaned_text(text, deduplicated)

    return {'flags': deduplicated, 'cleaned': cleaned}
