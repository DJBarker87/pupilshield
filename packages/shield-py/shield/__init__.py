"""
PupilSafe AI anonymisation library — Python port of @djb/shield.

Usage:
    from shield import Shield
    s = Shield(mode='accurate', seed=42)
    result = s.anonymise(data, config)
    output = s.deanonymise(ai_text, result['mapping'])
"""

import math
import re
import time
from typing import Any, Dict, List, Optional, Union

from .prng import mulberry32
from .anonymiser import anonymise_names, shuffle_rows, build_blocked_tokens
from .noise import add_noise_to_column
from .scanner import scan_text
from .risk import analyse_risk
from .deanonymiser import deanonymise
from .columns import detect_columns
from .identifiers import detect_identifier_columns


def _sanitise_cell(val: Any) -> Any:
    """Prefix a cell value if it starts with a formula-injection character."""
    if not isinstance(val, str):
        return val
    if val and val[0] in ('=', '+', '-', '@'):
        return f"'{val}"
    return val


def _derive_grade_band(
    value: float,
    boundaries: Optional[List[int]] = None,
) -> str:
    """Derive a grade band string from a numeric score value."""
    if boundaries is None:
        boundaries = [40, 50, 60, 70, 80, 90]
    if not math.isfinite(value):
        return ''
    for i in range(len(boundaries)):
        if value < boundaries[i]:
            lower = 0 if i == 0 else boundaries[i - 1]
            return f'{lower}-{boundaries[i] - 1}'
    return f'{boundaries[-1]}+'


def _derive_attendance_band(value: float) -> str:
    """Derive an attendance band string from a numeric attendance percentage."""
    if not math.isfinite(value):
        return ''
    if value < 80:
        return '<80%'
    if value < 90:
        return '80-89%'
    if value < 95:
        return '90-94%'
    return '95%+'


def _parse_csv(csv: str) -> Dict[str, Any]:
    """Parse a CSV string into headers and rows.

    Simple parser — handles quoted fields with "" escaping.
    """
    lines = csv.strip().split('\n')
    if not lines:
        return {'headers': [], 'rows': []}

    def parse_line(line: str) -> List[str]:
        cells = []
        current = ''
        in_quotes = False
        i = 0
        while i < len(line):
            ch = line[i]
            if ch == '"':
                if in_quotes and i + 1 < len(line) and line[i + 1] == '"':
                    current += '"'
                    i += 1
                else:
                    in_quotes = not in_quotes
            elif ch == ',' and not in_quotes:
                cells.append(current)
                current = ''
            else:
                current += ch
            i += 1
        cells.append(current)
        return cells

    headers = parse_line(lines[0])
    rows = [parse_line(l) for l in lines[1:] if l.strip()]
    return {'headers': headers, 'rows': rows}


class Shield:
    """Main Shield class — public API for the anonymisation library.

    Args:
        mode: Privacy mode ('accurate' or 'anonymous').
        seed: PRNG seed (time-based if not provided).
        noise: Noise configuration dict with 'percent' and 'boundaries'.
        gender: Gender mode ('aware' or 'neutral').
        k_threshold: k-anonymity threshold (int or 'auto').
    """

    def __init__(
        self,
        mode: str = 'accurate',
        seed: Optional[int] = None,
        noise: Optional[Dict[str, Any]] = None,
        gender: str = 'aware',
        k_threshold: Union[int, str] = 'auto',
        **kwargs: Any,
    ) -> None:
        self._mode = mode
        self._seed = seed if seed is not None else int(time.time() * 1000)
        self._noise = noise or {'percent': 0.05}
        self._gender = gender
        self._k_threshold = k_threshold
        self._prng = mulberry32(self._seed)

    def anonymise(
        self,
        data: Union[str, Dict[str, Any]],
        config: Optional[Dict[str, Any]] = None,
        one_way: bool = False,
        strip_identifiers: bool = False,
    ) -> Dict[str, Any]:
        """Full anonymisation pipeline.

        PRNG consumption order: name selection -> noise -> shuffle.

        Args:
            data: CSV string or dict with 'headers' and 'rows'.
            config: Configuration dict.
            one_way: If True, mapping is not returned (irreversible).
            strip_identifiers: If True, auto-remove identifier columns.

        Returns:
            Dict with anonymised data, mapping, risks, flags, detected, perturbation_failures.
        """
        if config is None:
            config = {}

        # Parse if string
        if isinstance(data, str):
            parsed = _parse_csv(data)
            headers = parsed['headers']
            rows = parsed['rows']
        else:
            headers = list(data['headers'])
            rows = [list(r) for r in data['rows']]

        # Strip identifier columns if requested (Python-only feature)
        if strip_identifiers:
            id_col_indices = detect_identifier_columns(headers)
            if id_col_indices:
                id_col_set = set(id_col_indices)
                headers = [h for i, h in enumerate(headers) if i not in id_col_set]
                rows = [
                    [cell for i, cell in enumerate(row) if i not in id_col_set]
                    for row in rows
                ]

        # Detect columns if not provided
        detected = detect_columns(headers, rows)
        name_col_index = config.get('nameColIndex', config.get('name_col_index'))
        if name_col_index is None:
            name_col = next((c for c in detected['columns'] if c['type'] == 'name'), None)
            name_col_index = name_col['index'] if name_col else 0

        gender_col_index = config.get('genderColIndex', config.get('gender_col_index'))
        if gender_col_index is None:
            gender_col = next(
                (c for c in detected['columns'] if re.search(r'gender', c['name'], re.IGNORECASE)),
                None,
            )
            gender_col_index = gender_col['index'] if gender_col else None

        # Identify numeric columns
        numeric_col_indices = config.get('numericColIndices', config.get('numeric_col_indices'))
        if numeric_col_indices is None:
            numeric_col_indices = [
                c['index'] for c in detected['columns'] if c['type'] == 'numerical'
            ]

        # Identify free-text columns for scanning
        free_text_indices = [
            c['index'] for c in detected['columns']
            if c['type'] == 'free-text' or re.search(r'comment|note|remark', c['name'], re.IGNORECASE)
        ]

        # Identify categorical columns for risk analysis
        categorical_columns = [
            {'index': c['index'], 'name': c['name']}
            for c in detected['columns']
            if c['type'] == 'categorical'
        ]

        # Extract known names for scanner
        known_names = [
            r[name_col_index] for r in rows
            if isinstance(r[name_col_index], str) and r[name_col_index].strip()
        ]

        # Scan free-text columns
        all_flags: List[Dict[str, Any]] = []
        for ft_idx in free_text_indices:
            for i, row in enumerate(rows):
                if ft_idx < len(row):
                    text = row[ft_idx]
                    if isinstance(text, str) and text.strip():
                        scan_result = scan_text(text, {
                            'knownNames': known_names,
                            'staffNames': config.get('staffNames', config.get('staff_names', [])),
                        })
                        for flag in scan_result['flags']:
                            all_flags.append({**flag, 'rowIndex': i, 'colIndex': ft_idx})

        # Build blocked tokens
        flag_tokens = [f['value'] for f in all_flags]
        staff_names = config.get('staffNames', config.get('staff_names', []))
        blocked_tokens = build_blocked_tokens(rows, name_col_index, flag_tokens, staff_names)

        # PRNG consumption order: 1. Name selection
        anon_result = anonymise_names(rows, name_col_index, self._prng, {
            'gender_col_index': gender_col_index,
            'gender_mode': self._gender,
            'blocked_tokens': blocked_tokens,
        })
        anon_rows = anon_result['rows']
        mapping = anon_result['mapping']

        # PRNG consumption order: 2. Noise (anonymous mode only)
        noised_rows = anon_rows
        perturbation_failures: Dict[int, int] = {}
        if self._mode == 'anonymous':
            noised_rows = [list(r) for r in anon_rows]
            max_value = config.get('maxValue', config.get('max_value', 100))
            noise_percent = self._noise.get('percent', 0.05)
            boundaries = self._noise.get('boundaries')

            for col_idx in numeric_col_indices:
                values = []
                for r in noised_rows:
                    if col_idx < len(r):
                        try:
                            v = float(r[col_idx])
                            values.append(v if math.isfinite(v) else r[col_idx])
                        except (ValueError, TypeError):
                            values.append(r[col_idx])
                    else:
                        values.append('')

                noise_result = add_noise_to_column(
                    values, max_value, noise_percent, boundaries, self._prng,
                )

                for i in range(len(noised_rows)):
                    if isinstance(noise_result['values'][i], (int, float)):
                        noised_rows[i][col_idx] = str(int(noise_result['values'][i]) if noise_result['values'][i] == int(noise_result['values'][i]) else noise_result['values'][i])
                if noise_result['perturbation_failures'] > 0:
                    perturbation_failures[col_idx] = noise_result['perturbation_failures']

        # PRNG consumption order: 3. Shuffle
        shuffled_rows = shuffle_rows(noised_rows, self._prng)

        # Sanitise against formula injection
        sanitised_rows = [
            [_sanitise_cell(cell) for cell in row]
            for row in shuffled_rows
        ]

        # Risk analysis
        quasi_identifiers = [c['index'] for c in categorical_columns]
        if gender_col_index is not None:
            quasi_identifiers.append(gender_col_index)

        # Derive grade bands and attendance bands
        risk_rows = sanitised_rows
        derived_categorical_columns = list(categorical_columns)
        grade_boundaries = self._noise.get('boundaries') or [40, 50, 60, 70, 80, 90]

        score_col_indices = [
            idx for idx in numeric_col_indices
            if re.search(r'score|mark|grade|percent', headers[idx] if idx < len(headers) else '', re.IGNORECASE)
        ]
        attendance_col_indices = [
            idx for idx in numeric_col_indices
            if re.search(r'attendance', headers[idx] if idx < len(headers) else '', re.IGNORECASE)
        ]

        if score_col_indices or attendance_col_indices:
            risk_rows = [list(row) for row in sanitised_rows]
            next_col_idx = len(headers)

            for col_idx in score_col_indices:
                band_idx = next_col_idx
                next_col_idx += 1
                for row in risk_rows:
                    try:
                        v = float(row[col_idx])
                    except (ValueError, TypeError, IndexError):
                        v = float('nan')
                    # Extend row if needed
                    while len(row) <= band_idx:
                        row.append('')
                    row[band_idx] = _derive_grade_band(v, grade_boundaries)
                quasi_identifiers.append(band_idx)
                derived_categorical_columns.append({
                    'index': band_idx,
                    'name': f'{headers[col_idx] if col_idx < len(headers) else "Score"} Band',
                })

            for col_idx in attendance_col_indices:
                band_idx = next_col_idx
                next_col_idx += 1
                for row in risk_rows:
                    try:
                        v = float(row[col_idx])
                    except (ValueError, TypeError, IndexError):
                        v = float('nan')
                    while len(row) <= band_idx:
                        row.append('')
                    row[band_idx] = _derive_attendance_band(v)
                quasi_identifiers.append(band_idx)
                derived_categorical_columns.append({
                    'index': band_idx,
                    'name': f'{headers[col_idx] if col_idx < len(headers) else "Attendance"} Band',
                })

        risks = analyse_risk(risk_rows, {
            'quasiIdentifiers': quasi_identifiers,
            'categoricalColumns': derived_categorical_columns,
            'kThreshold': self._k_threshold,
        })

        result = {
            'anonymised': {'headers': headers, 'rows': sanitised_rows},
            'mapping': mapping,
            'risks': risks,
            'flags': all_flags,
            'detected': detected,
            'perturbationFailures': perturbation_failures,
        }

        # Python-only: one_way mode — remove mapping
        if one_way:
            result['mapping'] = None

        return result

    def deanonymise(
        self,
        text: str,
        mapping: Dict[str, Any],
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """De-anonymise AI response text.

        Args:
            text: AI-generated text with fake names / ID tokens.
            mapping: The mapping object from anonymise().
            options: Options dict with 'strategy' key.

        Returns:
            De-anonymisation result.
        """
        return deanonymise(text, mapping, options)

    def analyse_risk(
        self,
        data: Union[List[List[Any]], Dict[str, Any]],
        config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Standalone risk analysis.

        Args:
            data: Row arrays or dict with 'headers' and 'rows'.
            config: Risk analysis configuration.

        Returns:
            Risk analysis results.
        """
        if config is None:
            config = {}
        rows = data if isinstance(data, list) else data['rows']
        return analyse_risk(rows, {
            **config,
            'kThreshold': config.get('kThreshold', config.get('k_threshold', self._k_threshold)),
        })

    def scan_text(
        self,
        text: str,
        config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Standalone free-text scanning.

        Args:
            text: Text to scan.
            config: Scanner configuration.

        Returns:
            Scanner results.
        """
        return scan_text(text, config)

    def detect_columns(
        self,
        headers_or_data: Union[List[str], Dict[str, Any]],
        rows: Optional[List[List[str]]] = None,
    ) -> Dict[str, Any]:
        """Standalone column detection.

        Args:
            headers_or_data: Headers list or dict with 'headers' and 'rows'.
            rows: Row arrays (if headers_or_data is a list).

        Returns:
            Column classifications.
        """
        if isinstance(headers_or_data, list):
            return detect_columns(headers_or_data, rows or [])
        return detect_columns(headers_or_data['headers'], headers_or_data['rows'])

    def add_noise(
        self,
        values: List[Any],
        config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Standalone noise application.

        Args:
            values: Values to noise.
            config: Noise configuration with max_value, percent, boundaries.

        Returns:
            Noised values.
        """
        if config is None:
            config = {}
        max_value = config.get('maxValue', config.get('max_value', 100))
        percent = config.get('percent', self._noise.get('percent', 0.05))
        boundaries = config.get('boundaries', self._noise.get('boundaries'))
        return add_noise_to_column(values, max_value, percent, boundaries, self._prng)
