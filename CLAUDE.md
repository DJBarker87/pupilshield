# CLAUDE.md — PupilSafe AI

## Project Overview

PupilSafe AI is a browser-based tool that lets UK secondary school teachers use AI assistants (ChatGPT, Claude, Gemini) with student data safely. It anonymises student data before it reaches any AI, generates effective prompts, and de-anonymises the AI's response.

**Core architecture:** A standalone JS library (`@djb/shield`) consumed by a Svelte web app. A Python port (`shield-py`) shares the same logic, data files, and test fixtures.

**Full specification:** `docs/design-doc-v2.2.md`

---

## Repository Structure

```
pupilsafe/
├── CLAUDE.md                    # This file — read first
├── docs/
│   └── design-doc-v2.2.md      # Full product design document
├── packages/
│   ├── shield/                  # @djb/shield — JS anonymisation library
│   │   ├── src/
│   │   │   ├── index.js         # Main Shield class (public API)
│   │   │   ├── prng.js          # Mulberry32 seeded PRNG
│   │   │   ├── rounding.js      # roundHalfAway + numeric utilities
│   │   │   ├── anonymiser.js    # Name replacement, shuffling, ID token generation
│   │   │   ├── noise.js         # Bounded Laplace noise, grade-boundary awareness
│   │   │   ├── scanner.js       # Free-text scanning (names, keywords, regex)
│   │   │   ├── risk.js          # k-anonymity, rare-category detection
│   │   │   ├── deanonymiser.js  # ID-first + structured + global replacement
│   │   │   ├── columns.js       # Column type detection heuristics
│   │   │   └── data/
│   │   │       ├── names.json        # Name bank (~500 first + ~500 surnames)
│   │   │       ├── keywords.json     # Medical/safeguarding/family term lists
│   │   │       └── generalisations.json  # Rare-category mapping table
│   │   ├── tests/
│   │   └── package.json
│   └── shield-py/               # Python port of @djb/shield
│       ├── shield/
│       │   ├── __init__.py      # Main Shield class
│       │   ├── prng.py          # Mulberry32 (identical to JS)
│       │   ├── rounding.py      # round_half_away (identical to JS)
│       │   ├── anonymiser.py
│       │   ├── noise.py
│       │   ├── scanner.py
│       │   ├── risk.py
│       │   ├── deanonymiser.py
│       │   ├── columns.py
│       │   ├── identifiers.py   # Server-only: known identifier patterns
│       │   └── data/            # Symlinked to packages/shield/src/data/
│       ├── tests/
│       └── pyproject.toml
├── test-fixtures/               # Shared between JS and Python
│   ├── sample-dataset.csv       # 22 fictitious students with privacy traps
│   └── (seed + expected output fixtures added during build)
├── apps/
│   └── web/                     # PupilSafe AI Svelte app (Phase 4)
└── prompts/                     # Prompt template definitions (Phase 3)
```

---

## CRITICAL CONSTRAINTS — READ BEFORE WRITING ANY CODE

### 1. No Native Randomness — EVER

All randomness MUST flow through the Mulberry32 seeded PRNG.

- **JS:** Never call `Math.random()`. Always use the PRNG instance from `prng.js`.
- **Python:** Never `import random`. Never call `random.random()` or any `random` module function. Always use the PRNG from `prng.py`.

The PRNG is created once per `Shield` construction and used for all operations in sequence. The consumption order is part of the contract: **name selection → noise → shuffle**. Both JS and Python must consume PRNG values in this identical order.

```javascript
// JS — Mulberry32
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
```

```python
# Python — Mulberry32 (must produce identical output to JS)
def mulberry32(seed):
    def _next():
        nonlocal seed
        seed = (seed + 0x6D2B79F5) & 0xFFFFFFFF
        t = ((seed ^ (seed >> 15)) * (1 | seed)) & 0xFFFFFFFF
        t = (t + (((t ^ (t >> 7)) * (61 | t)) & 0xFFFFFFFF) ^ t) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return _next
```

### 2. No Native Rounding — EVER

All rounding MUST use `roundHalfAway` (round half away from zero).

- **JS:** Never call `Math.round()`. Use `roundHalfAway()` from `rounding.js`.
- **Python:** Never call `round()`. Use `round_half_away()` from `rounding.py`.

```javascript
// JS
function roundHalfAway(x) {
  return Math.sign(x) * Math.floor(Math.abs(x) + 0.5);
}
```

```python
# Python
import math
def round_half_away(x):
    return math.copysign(math.floor(abs(x) + 0.5), x)
```

### 3. Cross-Language Parity Is Non-Negotiable

Given the same seed and input, JS and Python MUST produce **byte-identical** output. The `test-fixtures/` directory contains input CSVs, seeds, and expected outputs. Both test suites validate against these. If a test passes in one language and fails in the other, something has drifted.

Sources of divergence to avoid:
- Native `Math.random()` / `random.random()` — use Mulberry32
- Native `Math.round()` / `round()` — use roundHalfAway
- Float comparison edge cases — both are IEEE 754 double
- String sorting differences — use explicit locale-independent sorting
- Unicode normalisation — always NFKC before matching

### 4. Zero External Dependencies (Almost)

**JS library:** Zero runtime dependencies. Papa Parse is optional (for CSV parsing convenience). The library must work without it.

**Python library:** stdlib only — `re`, `unicodedata`, `json`, `math`. No `pandas`, no `numpy`, no `spaCy`, no `import random`.

### 5. Stateless Design

Every call is self-contained. Mapping is passed in/out explicitly. No global state, no singletons, no module-level mutable variables.

### 6. All Processing Synchronous and In-Memory

No async operations, no storage calls, no network calls in the library. The library is a pure computation engine.

---

## Build Phases

### Phase 1: `@djb/shield` (JS Library) — ~1.5 weeks

Build in this order. Each sub-phase should have tests before moving on.

#### 1a. Core Primitives
- `prng.js` — Mulberry32 with seed parameter
- `rounding.js` — roundHalfAway
- Data files: `names.json`, `keywords.json`, `generalisations.json`
- Tests: PRNG sequence verification (first 100 values for seed=42), rounding edge cases

#### 1b. Anonymiser + Noise Engine
- `anonymiser.js` — Name replacement with:
  - Rotating random names from the name bank
  - Blocked-tokens collision detection (real names, staff names, sibling names, flagged tokens)
  - Gender-aware and gender-neutral name assignment
  - Student ID token generation ([S01], [S02], etc.)
  - Row shuffling (Fisher-Yates using PRNG)
- `noise.js` — Bounded Laplace noise with:
  - Grade-boundary awareness (bands as [lower inclusive, upper exclusive) intervals)
  - Integer rounding of noised values
  - Narrow-band safety guard (1 possible integer → return original + flag)
  - Noised value allowed to equal original (genuine Laplace behaviour)
  - Clamping to valid range
- Tests: Deterministic output for known seeds, boundary cases, collision detection

#### 1c. Scanner + Risk Analysis
- `scanner.js` — Free-text scanning:
  - Class-list name matching (full, first-only, surname-only)
  - Keyword lists (medical, safeguarding, family — from keywords.json)
  - Regex patterns (dates, UK postcodes, phone numbers, email addresses)
  - Returns flagged items with types and positions
- `risk.js` — Re-identification risk analysis:
  - k-Anonymity checking on quasi-identifier set
  - Scaled threshold: k=5 for cohorts <20, k=3 for cohorts ≥20
  - Rare-category detection with generalisation suggestions
  - Plain-English recommendation strings
- Tests: Scanner catches planted traps, k-anonymity calculations correct

#### 1d. De-anonymiser
- `deanonymiser.js` — Four strategies:
  - `id-first` (default): ID regex → structured name → global name fallback
  - `json`: Parse JSON, walk structure, replace IDs + names
  - `structured-only`: ID + structured only, no global fallback
  - `global`: ID pass + global boundary-aware name replacement
- Unicode NFKC normalisation before matching
- Case-insensitive match with canonical-case replacement
- Boundary-aware regex (punctuation, quotes, possessives, all-caps)
- Longest-name-first replacement order
- Returns stats: idMatches, nameMatches, unmatched
- Tests: Various AI output formats, edge cases (curly quotes, possessives, all-caps)

#### 1e. Column Detection
- `columns.js` — Column type detection:
  - Name, numerical, categorical, free-text, date classification
  - Asymmetric confidence thresholds (90% for names, 75% for numeric/categorical)
  - Always-sensitive identifier detection (UPN, DOB, postcode, etc.)
  - UK MIS column recognition list (Form, House, Set, KS2, FFT, CAT, etc.)
  - Confidence scores returned per column
- Tests: Common UK school export formats, mixed-type columns

#### 1f. Integration + Sample Dataset
- `index.js` — Main Shield class wiring everything together
  - `shield.anonymise(data, config)` → anonymised data, mapping, risks, flags
  - `shield.deanonymise(text, mapping, options)` → de-anonymised text, unmatched, stats
  - `shield.analyseRisk(data, config)` → risk analysis
  - `shield.scanText(text, config)` → flagged items
  - `shield.detectColumns(data)` → column classifications
  - `shield.addNoise(values, config)` → noised values
- Sample dataset: 22 fictitious students with deliberate privacy traps
- **Regression test:** Automated blocking test asserting ALL planted traps caught with zero misses
- End-to-end tests: Full anonymise → de-anonymise round-trip

### Phase 2: `shield-py` (Python Port) — ~3-4 days

Straight port of all JS functionality. Validated against shared test fixtures.

Additional Python-only features:
- `one_way=True` — no mapping returned (irreversible)
- `strip_identifiers=True` — auto-remove UPN/DOB/postcode/email/phone/NHS columns

### Phase 3: Prompt Template System — ~1 week

3 free-tier templates with question flows and the 5 standard prompt instructions.
JSON schema output for structured analysis templates.

### Phase 4: Svelte UI — ~1.5 weeks

The web app consuming @djb/shield. All UI, no anonymisation logic.

---

## Key Design Decisions (Reference)

### Noise Engine
- Laplace distribution, NOT Gaussian
- Formula: `mu - b * sign(u) * ln(1 - 2 * |u|)` where `u = prng() - 0.5`
- Scale parameter `b = maxNoise / 2` where `maxNoise = maxValue * noisePercent`
- Default noise: ±3-5% of range
- Grade boundaries: `[lower, upper)` intervals — score of exactly 40 is in the 40-49 band
- Integer rounding reduces fingerprintability
- Narrow band (1 integer): return original + flag in `perturbationFailures`
- Noised value MAY equal original — this is correct Laplace behaviour

### De-anonymisation
- ID tokens `[SXX]` are the primary key (regex: `\[S\d{2,3}\]`)
- Name matching is the fallback, not the primary mechanism
- Strategy order for `id-first`: ID pass → structured name pass → global name pass
- Always normalise to NFKC before matching
- Always replace longest names first
- Case-insensitive match, canonical-case output (always output the real name in its stored casing)

### k-Anonymity
- Default quasi-identifiers: gender, SEN, PP, EAL, grade band, attendance band
- k=5 for cohorts <20 students, k=3 for ≥20 students
- Group-by on quasi-identifier columns, count per group, flag rows in groups < k

### Column Detection — Asymmetric Thresholds
- Names: ≥90% confidence required for auto-classification
- Free-text: ≥85%
- Dates: ≥80%
- Numerical/Categorical: ≥75%
- Below threshold → forced into review queue

### Name Bank
- ~250 male, ~250 female, ~50 neutral first names, ~500 surnames
- UK-diverse, no offensive/ambiguous names
- No surnames that are common English words (avoid false matches in free-text)
- Tagged by gender category in JSON

### Blocked Tokens Policy
The blocked set includes:
1. All real student names (first AND surname individually)
2. All tokens flagged in free-text scanning
3. Staff names from column headers or data
4. Any surname from class list appearing in free-text fields

A fake name is rejected if ANY component (first or surname) appears in the blocked set.

---

## Testing Strategy

- **Unit tests** for each module independently
- **Shared test fixtures** in `test-fixtures/` — validated by both JS and Python
- **Sample dataset regression test** — blocking test, all planted traps must be caught
- **Cross-language parity tests** — same seed + input → identical output
- **Edge case tests** for noise (narrow bands, boundary values, range clamping)
- **De-anonymisation tests** with real AI output formats from ChatGPT, Claude, Gemini

### Test Framework
- JS: Vitest (fast, ESM-native, good for library testing)
- Python: pytest

---

## Commands

### JS Library (@djb/shield)
```bash
cd packages/shield
npm install        # Install dev dependencies only (vitest)
npm test           # Run test suite
npm run build      # Bundle for distribution (if needed)
```

### Python Library (shield-py)
```bash
cd packages/shield-py
pip install -e .   # Install in development mode
pytest             # Run test suite
```

---

## Style & Conventions

### JavaScript
- ES modules (`import`/`export`), not CommonJS
- No classes except the main `Shield` class — prefer pure functions
- JSDoc comments on all public functions
- Descriptive variable names, no abbreviations except well-known ones (e.g. `prng`, `csv`)

### Python
- Python 3.9+ (runs on Raspberry Pi)
- Type hints on all public functions
- Docstrings (Google style) on all public functions
- Snake_case for functions/variables, PascalCase for classes

### Both Languages
- Functions should be small and testable
- No side effects in library code
- Errors thrown/raised, never silently swallowed
- All public API methods documented with examples
