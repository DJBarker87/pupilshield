"""Integration tests — Shield class, cross-language fixtures, privacy traps."""

import json
import re
from pathlib import Path

from shield import Shield

FIXTURES_DIR = Path(__file__).parent.parent.parent.parent / 'test-fixtures'


def _load_sample_csv():
    return (FIXTURES_DIR / 'sample-dataset.csv').read_text(encoding='utf-8')


def _load_expected():
    with open(FIXTURES_DIR / 'anonymised-seed42.json', encoding='utf-8') as f:
        return json.load(f)


class TestCrossLanguageFixture:
    """Validate Python output matches JS output exactly."""

    def test_mapping_matches_fixture(self):
        csv = _load_sample_csv()
        s = Shield(mode='accurate', seed=42)
        result = s.anonymise(csv)
        expected = _load_expected()

        # Check mapping.ids
        assert result['mapping']['ids'] == expected['mapping']['ids']

    def test_mapping_names_match_fixture(self):
        csv = _load_sample_csv()
        s = Shield(mode='accurate', seed=42)
        result = s.anonymise(csv)
        expected = _load_expected()

        assert result['mapping']['names'] == expected['mapping']['names']

    def test_mapping_name_to_id_match_fixture(self):
        csv = _load_sample_csv()
        s = Shield(mode='accurate', seed=42)
        result = s.anonymise(csv)
        expected = _load_expected()

        assert result['mapping']['nameToId'] == expected['mapping']['nameToId']

    def test_mapping_id_to_fake_match_fixture(self):
        csv = _load_sample_csv()
        s = Shield(mode='accurate', seed=42)
        result = s.anonymise(csv)
        expected = _load_expected()

        assert result['mapping']['idToFake'] == expected['mapping']['idToFake']

    def test_headers_match_fixture(self):
        csv = _load_sample_csv()
        s = Shield(mode='accurate', seed=42)
        result = s.anonymise(csv)
        expected = _load_expected()

        assert result['anonymised']['headers'] == expected['headers']

    def test_rows_match_fixture(self):
        csv = _load_sample_csv()
        s = Shield(mode='accurate', seed=42)
        result = s.anonymise(csv)
        expected = _load_expected()

        assert len(result['anonymised']['rows']) == len(expected['rows'])
        for i, (actual_row, expected_row) in enumerate(
            zip(result['anonymised']['rows'], expected['rows'])
        ):
            assert actual_row == expected_row, f"Row {i} mismatch:\n  actual:   {actual_row}\n  expected: {expected_row}"


class TestPrivacyTraps:
    """All planted privacy traps in sample-dataset must be caught."""

    def _get_flags(self):
        csv = _load_sample_csv()
        s = Shield(mode='accurate', seed=42)
        # Provide staff names and sibling names as the teacher would in the full app
        result = s.anonymise(csv, {
            'staffNames': ['Mrs Patel'],
        })
        return result['flags'], result

    def _get_flags_with_siblings(self):
        """Scan comments manually with sibling names (as the JS integration test does)."""
        from shield.scanner import scan_text
        csv = _load_sample_csv()
        lines = csv.strip().split('\n')
        header_parts = lines[0].split(',')
        rows = []
        for line in lines[1:]:
            if not line.strip():
                continue
            cells = []
            current = ''
            in_quotes = False
            for ch in line:
                if ch == '"':
                    in_quotes = not in_quotes
                    continue
                if ch == ',' and not in_quotes:
                    cells.append(current)
                    current = ''
                    continue
                current += ch
            cells.append(current)
            rows.append(cells)

        known_names = [r[0] for r in rows]
        sibling_names = ['Emily']
        all_known = known_names + sibling_names

        all_flags = []
        for row in rows:
            comment = row[7] if len(row) > 7 else ''
            if comment.strip():
                result = scan_text(comment, {
                    'knownNames': all_known,
                    'staffNames': ['Mrs Patel'],
                })
                all_flags.extend(result['flags'])
        return all_flags

    def test_trap1_sibling_name_emily(self):
        """Trap 1: Row 1 comment references sibling name 'Emily'."""
        flags = self._get_flags_with_siblings()
        name_flags = [f for f in flags if f['type'] == 'name']
        assert any('Emily' in f['value'] for f in name_flags), \
            "Trap 1 missed: sibling name 'Emily' not flagged"

    def test_trap2_epilepsy_hospital(self):
        """Trap 2: Row 2 comment mentions 'epilepsy' and 'hospital'."""
        flags = self._get_flags_with_siblings()
        kw_flags = [f for f in flags if f['type'] == 'keyword']
        assert any('epilepsy' in f['value'].lower() for f in kw_flags), \
            "Trap 2 missed: 'epilepsy' not flagged"
        assert any('hospital' in f['value'].lower() for f in kw_flags), \
            "Trap 2 missed: 'hospital' not flagged"

    def test_trap3_teacher_mrs_patel(self):
        """Trap 3: Row 4 comment references teacher 'Mrs Patel'."""
        flags = self._get_flags_with_siblings()
        name_flags = [f for f in flags if f['type'] == 'name']
        assert any('Patel' in f['value'] for f in name_flags), \
            "Trap 3 missed: 'Mrs Patel' not flagged"

    def test_trap4_date(self):
        """Trap 4: Row 7 comment contains date '15/03/2024'."""
        flags = self._get_flags_with_siblings()
        date_flags = [f for f in flags if f['type'] == 'date']
        assert any('15/03/2024' in f['value'] for f in date_flags), \
            "Trap 4 missed: date '15/03/2024' not flagged"

    def test_trap5_mother(self):
        """Trap 5: Row 9 comment contains family term 'mother'."""
        flags = self._get_flags_with_siblings()
        kw_flags = [f for f in flags if f['type'] == 'keyword']
        assert any('mother' in f['value'].lower() for f in kw_flags), \
            "Trap 5 missed: 'mother' not flagged"

    def test_trap6_unique_k_anonymity(self):
        """Trap 6: Oliver Thompson (EHCP+PP) has unique k-anonymity group."""
        _, result = self._get_flags()
        risks = result['risks']
        # Should have flagged groups
        assert len(risks['kAnonymity']['flaggedGroups']) > 0, \
            "Trap 6 missed: no flagged k-anonymity groups"

    def test_trap7_teaching_assistant(self):
        """Trap 7: Row 16 comment has 'teaching assistant support'."""
        flags = self._get_flags_with_siblings()
        kw_flags = [f for f in flags if f['type'] == 'keyword']
        assert any('teaching assistant' in f['value'].lower() for f in kw_flags), \
            "Trap 7 missed: 'teaching assistant' not flagged"


class TestPythonOnlyFeatures:
    """Python-only features: one_way, strip_identifiers."""

    def test_one_way_no_mapping(self):
        csv = _load_sample_csv()
        s = Shield(mode='accurate', seed=42)
        result = s.anonymise(csv, one_way=True)
        assert result['mapping'] is None

    def test_strip_identifiers(self):
        csv = "Name,UPN,DOB,Score\nJames Chen,A123456789,01/01/2010,72\n"
        s = Shield(mode='accurate', seed=42)
        result = s.anonymise(csv, strip_identifiers=True)
        # UPN and DOB columns should be removed
        assert 'UPN' not in result['anonymised']['headers']
        assert 'DOB' not in result['anonymised']['headers']
        assert 'Name' in result['anonymised']['headers']
        assert 'Score' in result['anonymised']['headers']


class TestNoForbiddenImports:
    """Ensure no forbidden imports exist in any source file."""

    def test_no_import_random(self):
        shield_dir = Path(__file__).parent.parent / 'shield'
        for py_file in shield_dir.glob('*.py'):
            content = py_file.read_text()
            for line in content.split('\n'):
                stripped = line.strip()
                # Skip comments and docstrings
                if stripped.startswith('#') or stripped.startswith('"') or stripped.startswith("'"):
                    continue
                # Only match actual import statements
                if re.match(r'^(from\s+random\s+import|import\s+random)\b', stripped):
                    assert False, \
                        f"Forbidden 'import random' found in {py_file.name}"

    def test_no_bare_round(self):
        shield_dir = Path(__file__).parent.parent / 'shield'
        for py_file in shield_dir.glob('*.py'):
            content = py_file.read_text()
            # Remove docstrings and comments before checking
            in_docstring = False
            for line_num, line in enumerate(content.split('\n'), 1):
                stripped = line.strip()
                # Track triple-quote docstrings
                if '"""' in stripped or "'''" in stripped:
                    count = stripped.count('"""') + stripped.count("'''")
                    if count == 1:
                        in_docstring = not in_docstring
                    continue
                if in_docstring:
                    continue
                if stripped.startswith('#'):
                    continue
                # Look for round( but allow round_half_away(
                if re.search(r'(?<!\w)round\s*\(', stripped) and 'round_half_away' not in stripped:
                    assert False, \
                        f"Forbidden 'round()' found in {py_file.name}:{line_num}: {stripped}"


class TestRoundTrip:
    """End-to-end anonymise -> deanonymise round-trip."""

    def test_full_round_trip(self):
        csv = _load_sample_csv()
        s = Shield(mode='accurate', seed=42)
        result = s.anonymise(csv)

        # Build AI output using anonymised data
        rows = result['anonymised']['rows']
        ai_text = 'Here is my analysis:\n'
        for row in rows[:3]:
            ai_text += f'- {row[0]} scored {row[5]}%\n'

        # De-anonymise
        deresult = s.deanonymise(ai_text, result['mapping'])

        # All fake names in the text should be replaced
        assert len(deresult['unmatched']) == 0 or all(
            name.lower() not in deresult['text'].lower()
            for name in deresult['unmatched']
        )
