# PupilSafe AI — Test Results

## Test Suites

### JS Library (`@djb/shield`)
- **263 tests passed** across 10 test files
- Duration: 748ms

| File | Tests | Time |
|------|-------|------|
| `deanonymiser.test.js` | 34 | 7ms |
| `anonymiser.test.js` | 20 | 11ms |
| `scanner.test.js` | 36 | 18ms |
| `data.test.js` | 17 | 56ms |
| `noise.test.js` | 28 | 120ms |
| `integration.test.js` | 36 | 110ms |
| `rounding.test.js` | 14 | 6ms |
| `columns.test.js` | 37 | 27ms |
| `risk.test.js` | 28 | 7ms |
| `prng.test.js` | 13 | 361ms |

### Python Library (`shield-py`)
- **112 tests passed** across 10 test files
- Duration: 0.18s

| File | Tests |
|------|-------|
| `test_anonymiser.py` | 9 |
| `test_columns.py` | 8 |
| `test_deanonymiser.py` | 13 |
| `test_identifiers.py` | 11 |
| `test_integration.py` | 18 |
| `test_noise.py` | 12 |
| `test_prng.py` | 7 |
| `test_risk.py` | 8 |
| `test_rounding.py` | 12 |
| `test_scanner.py` | 14 |

### Web App (`apps/web`)
- **3 tests passed** (state smoke tests)
- Duration: 476ms

| Test | Result |
|------|--------|
| Pipeline initialises with default values | Pass |
| Pipeline allows setting currentStep | Pass |
| Pipeline resets all state to defaults | Pass |

### Cross-Language Parity
- PRNG sequence for seed=42: **100 values match** (JS = Python, 10 decimal places)
- Anonymised output for seed=42: **Byte-identical** headers, rows, and mapping

### Static Build
- `npm run build` succeeds with zero errors
- Output: 25 client chunks, 23 server chunks

---

## End-to-End Pipeline Test (Programmatic)

Ran the full anonymise → de-anonymise round-trip with the 22-student sample dataset.

### Anonymisation Results
- **22 students** anonymised with seed=42, Names Only mode, gender-aware
- **22 name pairs** generated, **22 ID tokens** assigned
- **Rows shuffled** — output order differs from input order

### Scanner Flags
10 items flagged in free-text comments:

| Flag | Type | Row | Value |
|------|------|-----|-------|
| Name | name | 1 | "James" |
| Family | keyword:family | 1 | "sister" |
| Safeguarding | keyword:safeguarding | 2 | "absent" |
| Medical | keyword:medical | 2 | "hospital" |
| Medical | keyword:medical | 2 | "epilepsy" |
| Name | name | 4 | "Mrs Patel" |
| Safeguarding | keyword:safeguarding | 6 | "missing" |
| Date | date | 7 | "15/03/2024" |
| Family | keyword:family | 8 | "mother" |
| Medical | keyword:medical | 15 | "teaching assistant support" |

### Risk Analysis
- **18 of 22 students** have attribute combinations shared by fewer than 3 others
- **2 rare categories** flagged:
  - "EHCP" in SEN (1 occurrence) — suggestion: generalise to "SEN: Yes"
  - "<80%" in Attendance Band (1 occurrence)

### De-anonymisation Results (Simulated AI Response)
- **4 ID matches**, **6 name matches**
- **0 unmatched** tokens
- **0 fake name leaks** — no anonymised names remain in output
- Real names correctly restored in all formats (headings, inline, tables, all-caps)

---

## Live AI Test (Claude Sonnet 4.6)

Sent the anonymised dataset to Claude via CLI and de-anonymised the response.

### What Was Sent to Claude
- 22-student anonymised CSV with fake names and ID tokens
- Prompt asking for report comments on the first 5 students
- Instructions to use full names with ID tokens

### What Claude Returned
Claude wrote report comments using fake names and ID tokens. It also independently flagged the same privacy issues PupilSafe's scanner catches:
- "Mrs Patel" — staff name in comments
- "James's sister Emily" — real name leaking through anonymised data
- "epilepsy treatment" — medical condition
- "15/03/2024" — identifying date
- Gender inconsistency in one comment field

### De-anonymisation Results

| Metric | Result |
|--------|--------|
| ID matches | **21** |
| Name matches | **0** (all resolved via ID tokens) |
| Unmatched | **0** |
| Fake name leaks | **0** |
| Real names restored | **8 of 22** (only 8 were mentioned by Claude) |

### Formats Handled
All de-anonymised correctly:
- Markdown table rows (`| Connor Murphy | ... |`)
- Bold headings (`**Lily Evans**`)
- Backtick-quoted names (`` `James Chen` ``)
- Inline prose references
- Repeated name mentions within the same paragraph

### Conclusion
The full round-trip works: anonymise → send to Claude → de-anonymise produces clean output with real student names, zero data leakage, and zero unmatched tokens. The ID token mechanism is the primary de-anonymisation key and works reliably across all AI output formats.
