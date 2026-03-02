"""
Re-identification risk analysis: k-anonymity and rare-category detection.
Pure functions, stdlib only.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

# Load generalisations
_DATA_DIR = Path(__file__).parent / 'data'
with open(_DATA_DIR / 'generalisations.json', 'r', encoding='utf-8') as _f:
    _generalisations = json.load(_f)


def analyse_risk(
    data: List[List[Any]],
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Analyse re-identification risk of a dataset.

    Args:
        data: Array of row arrays (no header row).
        config: Configuration with quasi_identifiers, categorical_columns, k_threshold.

    Returns:
        Dict with k_anonymity, rare_categories, recommendations.
    """
    if config is None:
        config = {}

    quasi_identifiers = config.get('quasiIdentifiers', config.get('quasi_identifiers', []))
    categorical_columns = config.get('categoricalColumns', config.get('categorical_columns', []))
    k_threshold = config.get('kThreshold', config.get('k_threshold', 'auto'))

    total_students = len(data)

    if k_threshold == 'auto':
        k = 5 if total_students < 20 else 3
    else:
        k = k_threshold

    k_anonymity = _compute_k_anonymity(data, quasi_identifiers, k, total_students)
    rare_categories = _detect_rare_categories(data, categorical_columns, k)
    recommendations = _build_recommendations(k_anonymity, rare_categories, k)

    return {
        'kAnonymity': k_anonymity,
        'rareCategories': rare_categories,
        'recommendations': recommendations,
    }


def _compute_k_anonymity(
    data: List[List[Any]],
    qi_cols: List[int],
    k: int,
    total_students: int,
) -> Dict[str, Any]:
    """Group rows by quasi-identifier values and flag small groups."""
    if total_students == 0 or len(qi_cols) == 0:
        return {
            'threshold': k,
            'totalStudents': total_students,
            'safeStudents': total_students,
            'flaggedGroups': [],
        }

    # Build groups keyed by composite quasi-identifier string
    groups: Dict[str, Dict[str, Any]] = {}

    for i, row in enumerate(data):
        key = '\x00'.join(str(row[col] if col < len(row) else '') for col in qi_cols)
        if key not in groups:
            groups[key] = {
                'attrs': [row[col] if col < len(row) else '' for col in qi_cols],
                'indices': [],
            }
        groups[key]['indices'].append(i)

    flagged_groups = []
    flagged_count = 0

    for group in groups.values():
        if len(group['indices']) < k:
            attributes = {}
            for idx, col in enumerate(qi_cols):
                attributes[f'col{col}'] = group['attrs'][idx]
            flagged_groups.append({
                'attributes': attributes,
                'count': len(group['indices']),
                'rowIndices': group['indices'],
            })
            flagged_count += len(group['indices'])

    # Sort by count ascending
    flagged_groups.sort(key=lambda g: g['count'])

    return {
        'threshold': k,
        'totalStudents': total_students,
        'safeStudents': total_students - flagged_count,
        'flaggedGroups': flagged_groups,
    }


def _detect_rare_categories(
    data: List[List[Any]],
    categorical_columns: List[Dict[str, Any]],
    k: int,
) -> List[Dict[str, Any]]:
    """Detect rare categories in categorical columns."""
    if not categorical_columns or len(data) == 0:
        return []

    rare_threshold = min(3, k)
    results = []

    for col_info in categorical_columns:
        index = col_info['index']
        name = col_info['name']

        # Count occurrences
        counts: Dict[Any, int] = {}
        for row in data:
            val = row[index] if index < len(row) else ''
            if val is None:
                val = ''
            counts[val] = counts.get(val, 0) + 1

        for value, count in counts.items():
            if count < rare_threshold:
                suggestion = _lookup_generalisation(name, value)
                results.append({
                    'column': index,
                    'columnName': name,
                    'value': value,
                    'count': count,
                    'suggestion': suggestion,
                })

    # Sort by count ascending, then by column index
    results.sort(key=lambda r: (r['count'], r['column']))

    return results


def _lookup_generalisation(category_name: str, value: Any) -> Optional[str]:
    """Look up a generalisation suggestion for a given category name and value."""
    str_value = str(value)

    # Try exact category match first (case-insensitive)
    for cat_key, mapping in _generalisations.items():
        if cat_key.lower() == category_name.lower():
            for map_key, suggestion in mapping.items():
                if map_key.lower() == str_value.lower():
                    return suggestion
            return None

    # Category not found — search all categories for the value
    for mapping in _generalisations.values():
        for map_key, suggestion in mapping.items():
            if map_key.lower() == str_value.lower():
                return suggestion

    return None


def _build_recommendations(
    k_anonymity: Dict[str, Any],
    rare_categories: List[Dict[str, Any]],
    k: int,
) -> List[str]:
    """Build plain-English recommendation strings."""
    recommendations = []
    total_students = k_anonymity['totalStudents']
    safe_students = k_anonymity['safeStudents']
    flagged_groups = k_anonymity['flaggedGroups']

    if total_students == 0:
        recommendations.append('No data to analyse.')
        return recommendations

    flagged_count = total_students - safe_students

    if len(flagged_groups) == 0:
        recommendations.append(
            f'All {total_students} students are in groups of {k}+. '
            f'No re-identification risk detected from quasi-identifiers.'
        )
    else:
        has_str = ' has' if flagged_count == 1 else 's have'
        recommendations.append(
            f'{safe_students} of {total_students} students are in groups of {k}+. '
            f'{flagged_count} student{has_str} attribute combinations shared by fewer than {k} others.'
        )

        for group in flagged_groups:
            attr_desc = ', '.join(
                f'{key}={val}' for key, val in group['attributes'].items()
            )
            s = '' if group['count'] == 1 else 's'
            recommendations.append(
                f'Group ({attr_desc}): {group["count"]} student{s} '
                f'— consider generalising or suppressing distinguishing attributes.'
            )

    if rare_categories:
        for rare in rare_categories:
            s = '' if rare['count'] == 1 else 's'
            msg = (
                f'Rare category in "{rare["columnName"]}": '
                f'"{rare["value"]}" appears only {rare["count"]} time{s}.'
            )
            if rare['suggestion']:
                msg += f' Consider generalising to "{rare["suggestion"]}".'
            recommendations.append(msg)

    return recommendations
