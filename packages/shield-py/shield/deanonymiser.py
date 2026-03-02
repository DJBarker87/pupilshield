"""
De-anonymisation engine.

Strategies:
 - id-first (default): ID regex -> structured name -> global name fallback
 - json: Parse JSON, walk structure, replace IDs + names
 - structured-only: ID + structured only, no global fallback
 - global: ID pass + global boundary-aware name replacement

All text is NFKC-normalised before matching.
"""

import json
import re
import unicodedata
from typing import Any, Dict, List, Optional, Union


def _nfkc(s: str) -> str:
    """Normalise a string to Unicode NFKC form."""
    return unicodedata.normalize('NFKC', s)


def _escape_regex(s: str) -> str:
    """Escape a string for use in a regex."""
    return re.escape(s)


def _name_boundary_regex(name: str, flags: int = re.IGNORECASE) -> re.Pattern:
    """Build a boundary-aware regex for a name string."""
    escaped = _escape_regex(name)
    return re.compile(r'(?<!\w)' + escaped + r'(?!\w)', flags)


def _global_name_replace(
    text: str,
    names_map: Dict[str, str],
) -> Dict[str, Any]:
    """Replace all fake names using boundary-aware, case-insensitive matching.

    Longest names are replaced first.
    """
    result = text
    count = 0

    # Sort fake names longest-first
    fake_names = sorted(names_map.keys(), key=len, reverse=True)

    for fake_name in fake_names:
        real_name = names_map[fake_name]
        escaped = _escape_regex(fake_name)
        regex = re.compile(r'(?<!\w)' + escaped + r'(?!\w)', re.IGNORECASE)

        def _replacer(m):
            nonlocal count
            count += 1
            return real_name

        result = regex.sub(_replacer, result)

    return {'text': result, 'count': count}


# ID regex pattern: matches [S01], [S02], ..., [S999]
_ID_PATTERN = re.compile(r'\[S\d{2,3}\]')


def _build_fake_name_id_pattern(fake_names: List[str]) -> re.Pattern:
    """Build pattern for "Fake Name [SXX]"."""
    sorted_names = sorted(fake_names, key=len, reverse=True)
    escaped = [_escape_regex(n) for n in sorted_names]
    pattern = r'(?<!\w)(' + '|'.join(escaped) + r')\s*(\[S\d{2,3}\])'
    return re.compile(pattern, re.IGNORECASE)


def _id_pass(text: str, mapping: Dict[str, Any]) -> Dict[str, Any]:
    """Run the ID replacement pass."""
    result = text
    id_matches = 0
    ids = mapping['ids']
    fake_names = list((mapping.get('names') or {}).keys())

    # First pass: replace "FakeName [SXX]" combined patterns
    if fake_names:
        combined_pattern = _build_fake_name_id_pattern(fake_names)

        def _combined_replacer(m):
            nonlocal id_matches
            id_part = m.group(2)
            id_key = id_part[1:-1]  # Remove brackets: [S01] -> S01
            real_name = ids.get(id_key)
            if real_name:
                id_matches += 1
                return real_name
            return m.group(0)

        result = combined_pattern.sub(_combined_replacer, result)

    # Second pass: replace remaining standalone [SXX] tokens
    def _standalone_replacer(m):
        nonlocal id_matches
        id_key = m.group(0)[1:-1]  # [S01] -> S01
        real_name = ids.get(id_key)
        if real_name:
            id_matches += 1
            return real_name
        return m.group(0)

    result = _ID_PATTERN.sub(_standalone_replacer, result)

    return {'text': result, 'idMatches': id_matches}


def _structured_table_pass(
    text: str,
    names_map: Dict[str, str],
) -> Dict[str, Any]:
    """Detect and replace fake names in markdown table rows."""
    count = 0
    lines = text.split('\n')
    result_lines = []

    # Sort fake names longest-first
    fake_names = sorted(names_map.keys(), key=len, reverse=True)

    name_col_index = -1
    in_table = False
    header_seen = False

    for i, line in enumerate(lines):
        trimmed = line.strip()

        # Detect table header row
        if trimmed.startswith('|') and trimmed.endswith('|') and not in_table:
            cells = [c.strip() for c in trimmed.split('|') if c.strip() != '']
            # Handle the split - filter empty strings from leading/trailing |
            raw_cells = trimmed.split('|')
            filtered_cells = [c.strip() for c in raw_cells[1:-1]]

            name_col_idx = -1
            for ci, c in enumerate(filtered_cells):
                if re.match(r'^(student|name|pupil|student\s+name|pupil\s+name)$', c, re.IGNORECASE):
                    name_col_idx = ci
                    break

            if name_col_idx >= 0:
                in_table = True
                header_seen = False
                name_col_index = name_col_idx
                result_lines.append(line)
                continue

        # Skip separator row
        if in_table and not header_seen and re.match(r'^\|[\s\-:|]+\|$', trimmed):
            header_seen = True
            result_lines.append(line)
            continue

        # Process data rows in the table
        if in_table and header_seen and trimmed.startswith('|') and trimmed.endswith('|'):
            cells = trimmed.split('|')
            data_cells = cells[1:-1]  # Skip leading/trailing empty strings
            if name_col_index < len(data_cells):
                cell = data_cells[name_col_index]
                for fake_name in fake_names:
                    real_name = names_map[fake_name]
                    regex = re.compile(_escape_regex(fake_name), re.IGNORECASE)

                    def _make_replacer(rn):
                        def _replacer(m):
                            nonlocal count
                            count += 1
                            return rn
                        return _replacer

                    cell = regex.sub(_make_replacer(real_name), cell)
                data_cells[name_col_index] = cell
                result_lines.append('|' + '|'.join(data_cells) + '|')
                continue

        # End of table
        if in_table and header_seen and not (trimmed.startswith('|') and trimmed.endswith('|')):
            in_table = False
            name_col_index = -1

        result_lines.append(line)

    return {'text': '\n'.join(result_lines), 'count': count}


def _structured_prefix_pass(
    text: str,
    names_map: Dict[str, str],
) -> Dict[str, Any]:
    """Replace fake names in "STUDENT: FakeName" patterns."""
    count = 0

    fake_names = sorted(names_map.keys(), key=len, reverse=True)

    for fake_name in fake_names:
        real_name = names_map[fake_name]
        escaped = _escape_regex(fake_name)
        regex = re.compile(
            r'((?:student|STUDENT|Student):\s*)' + escaped,
            re.IGNORECASE,
        )

        def _make_replacer(rn):
            def _replacer(m):
                nonlocal count
                count += 1
                return m.group(1) + rn
            return _replacer

        text = regex.sub(_make_replacer(real_name), text)

    return {'text': text, 'count': count}


def _walk_json(value: Any, mapping: Dict[str, Any], stats: Dict[str, int]) -> Any:
    """Walk a JSON value recursively, replacing IDs and fake names."""
    if isinstance(value, str):
        result = value

        # Replace IDs
        def _id_replacer(m):
            id_key = m.group(0)[1:-1]
            real_name = mapping['ids'].get(id_key)
            if real_name:
                stats['idMatches'] += 1
                return real_name
            return m.group(0)

        result = _ID_PATTERN.sub(_id_replacer, result)

        # Replace fake names (longest first)
        fake_names = sorted(mapping['names'].keys(), key=len, reverse=True)
        for fake_name in fake_names:
            real_name = mapping['names'][fake_name]
            regex = re.compile(_escape_regex(fake_name), re.IGNORECASE)

            def _make_replacer(rn):
                def _replacer(m):
                    stats['nameMatches'] += 1
                    return rn
                return _replacer

            result = regex.sub(_make_replacer(real_name), result)

        return result

    if isinstance(value, list):
        return [_walk_json(item, mapping, stats) for item in value]

    if isinstance(value, dict):
        return {key: _walk_json(val, mapping, stats) for key, val in value.items()}

    return value


def _find_unmatched(text: str, names_map: Dict[str, str]) -> List[str]:
    """Find fake names that remain unreplaced in the text."""
    unmatched = []
    normalised = _nfkc(text).lower()
    for fake_name in names_map:
        if _nfkc(fake_name).lower() in normalised:
            unmatched.append(fake_name)
    return unmatched


def _id_first_strategy(
    text: str,
    mapping: Dict[str, Any],
    stats: Dict[str, Any],
) -> Dict[str, Any]:
    """id-first strategy: ID pass -> structured pass -> global pass."""
    # 1. ID pass
    id_result = _id_pass(text, mapping)
    text = id_result['text']
    stats['idMatches'] = id_result['idMatches']

    # 2. Structured name pass
    table_result = _structured_table_pass(text, mapping['names'])
    text = table_result['text']
    stats['nameMatches'] += table_result['count']

    prefix_result = _structured_prefix_pass(text, mapping['names'])
    text = prefix_result['text']
    stats['nameMatches'] += prefix_result['count']

    # 3. Global name pass
    global_result = _global_name_replace(text, mapping['names'])
    text = global_result['text']
    stats['nameMatches'] += global_result['count']

    stats['unmatched'] = _find_unmatched(text, mapping['names'])

    return {'text': text, 'unmatched': stats['unmatched'], 'stats': stats}


def _json_strategy(
    text: str,
    mapping: Dict[str, Any],
    stats: Dict[str, Any],
) -> Dict[str, Any]:
    """json strategy: parse JSON, walk and replace, return parsed object."""
    try:
        parsed = json.loads(text)
        replaced = _walk_json(parsed, mapping, stats)
        stats['unmatched'] = []
        return {'parsed': replaced, 'valid': True, 'stats': stats}
    except (json.JSONDecodeError, ValueError):
        result = _id_first_strategy(text, mapping, stats)
        return {'text': result['text'], 'valid': False, 'stats': result['stats']}


def _structured_only_strategy(
    text: str,
    mapping: Dict[str, Any],
    stats: Dict[str, Any],
) -> Dict[str, Any]:
    """structured-only strategy: ID pass + structured pass only."""
    # 1. ID pass
    id_result = _id_pass(text, mapping)
    text = id_result['text']
    stats['idMatches'] = id_result['idMatches']

    # 2. Structured name pass
    table_result = _structured_table_pass(text, mapping['names'])
    text = table_result['text']
    stats['nameMatches'] += table_result['count']

    prefix_result = _structured_prefix_pass(text, mapping['names'])
    text = prefix_result['text']
    stats['nameMatches'] += prefix_result['count']

    stats['unmatched'] = _find_unmatched(text, mapping['names'])

    return {'text': text, 'unmatched': stats['unmatched'], 'stats': stats}


def _global_strategy(
    text: str,
    mapping: Dict[str, Any],
    stats: Dict[str, Any],
) -> Dict[str, Any]:
    """global strategy: ID pass + global boundary-aware replacement."""
    # 1. ID pass
    id_result = _id_pass(text, mapping)
    text = id_result['text']
    stats['idMatches'] = id_result['idMatches']

    # 2. Global name pass
    global_result = _global_name_replace(text, mapping['names'])
    text = global_result['text']
    stats['nameMatches'] += global_result['count']

    stats['unmatched'] = _find_unmatched(text, mapping['names'])

    return {'text': text, 'unmatched': stats['unmatched'], 'stats': stats}


def deanonymise(
    text: str,
    mapping: Dict[str, Any],
    options: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """De-anonymise text using the provided mapping and strategy.

    Args:
        text: The AI-generated text containing fake names / ID tokens.
        mapping: The anonymisation mapping object.
        options: Options dict with 'strategy' key.

    Returns:
        De-anonymisation result dict.
    """
    if options is None:
        options = {}

    strategy = options.get('strategy', 'id-first')

    # NFKC normalise input text
    normalised = _nfkc(text)

    stats: Dict[str, Any] = {'idMatches': 0, 'nameMatches': 0, 'unmatched': []}

    if strategy == 'json':
        return _json_strategy(normalised, mapping, stats)

    if strategy == 'id-first':
        return _id_first_strategy(normalised, mapping, stats)

    if strategy == 'structured-only':
        return _structured_only_strategy(normalised, mapping, stats)

    if strategy == 'global':
        return _global_strategy(normalised, mapping, stats)

    raise ValueError(f'Unknown de-anonymisation strategy: {strategy}')
