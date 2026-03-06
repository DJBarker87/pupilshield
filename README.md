# PupilSafe AI

**Use AI with student data — safely.** Paste your class data, get AI-powered insights, and student names never leave your browser.

PupilSafe AI lets UK secondary school teachers use ChatGPT, Claude, and Gemini with real student data by automatically anonymising it first, generating effective prompts, and de-anonymising the AI's response — all client-side, in under 60 seconds.

---

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   SHIELD    │     │   PROMPT    │     │  TRANSLATE   │
│             │     │             │     │              │
│ Paste your  │────▶│ Pick a task │────▶│ Paste AI's   │
│ class data  │     │ & answer    │     │ response     │
│             │     │ 2-3 Qs      │     │              │
│ Names       │     │             │     │ Real names   │
│ replaced,   │     │ Complete    │     │ restored     │
│ data        │     │ prompt      │     │ automatically│
│ protected   │     │ generated   │     │              │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 1. Shield — Anonymise
- Student names replaced with realistic fake names + ID tokens `[S01]`, `[S02]`...
- Free-text comments scanned for names, medical terms, safeguarding keywords, dates, postcodes, phone numbers
- Optional statistical noise (Laplace distribution, grade-boundary-aware)
- Row order shuffled to prevent positional correlation
- k-anonymity risk analysis with plain-English recommendations

### 2. Prompt — Generate
- Choose from curated task templates (report comments, class analysis, differentiated questions)
- Answer 2-3 targeted questions
- Get a complete, well-structured prompt with your anonymised data embedded

### 3. Translate — De-anonymise
- Paste the AI's response back
- Real names restored automatically using dual-key matching (ID tokens + name fallback)
- Output ready to use — copy and paste into your reports

---

## Privacy Architecture

**Zero backend. Zero data collection. Zero accounts.**

All processing happens in your browser. No student data is ever sent to our servers because there are no servers.

| Layer | Protection | Mode |
|-------|-----------|------|
| Rotating random names | Real names replaced with fake UK-diverse names | Both |
| Free-text scanning | Detects names, medical terms, dates, postcodes in comments | Both |
| Row shuffling | Prevents positional correlation | Both |
| k-Anonymity analysis | Flags re-identification risks from attribute combinations | Both |
| Bounded Laplace noise | Shifts numerical values within grade boundaries | Anonymous only |
| Rare-category detection | Suggests generalisations for identifying categories (e.g. EHCP → SEN: Yes) | Both |

**Verify it yourself:** Open DevTools → Network tab → use the tool → zero outbound requests.

---

## Two Privacy Modes

**Names Only (Accurate Mode)**
Names changed, numbers exact. Suitable for most classroom datasets where name replacement alone provides sufficient GDPR compliance.

**Names + Noise (Anonymous Mode)**
Names changed, numbers shifted. Adds bounded statistical noise to all numerical values. Grade-boundary-aware — no student accidentally flipped across a pass/fail threshold. Recommended for sensitive data (SEN, behaviour, safeguarding notes).

---

## Free Templates

| Template | Output | Use Case |
|----------|--------|----------|
| Write Report Comments | Prose | Individual student comments with tone/length control |
| Analyse Class Performance | Structured JSON | Intervention groups, trends, outlier identification |
| Generate Differentiated Questions | Prose | Tiered questions matched to student ability groups |

---

## Repository Structure

```
pupilsafe/
├── packages/
│   ├── shield/              # @djb/shield — JS anonymisation library
│   │   ├── src/             # 9 core modules (anonymiser, noise, scanner, risk, deanonymiser, columns, prng, rounding)
│   │   ├── src/data/        # Name bank (950+ names), keywords, generalisations
│   │   └── tests/           # 260+ test cases (Vitest)
│   └── shield-py/           # Python port — byte-identical output for same seed
│       ├── shield/          # Same modules, stdlib only
│       └── tests/           # Cross-language parity tests (pytest)
├── apps/
│   └── web/                 # SvelteKit web app (static build)
│       └── src/
│           ├── routes/      # Landing page, /app, /privacy, /how-it-works
│           └── lib/         # Components, state management, design system
├── prompts/                 # Template engine (Node + browser versions)
├── test-fixtures/           # Shared between JS and Python
│   ├── sample-dataset.csv   # 22 students with planted privacy traps
│   ├── prng-sequence-seed42.json
│   └── anonymised-seed42.json
└── docs/
    └── design-doc-v2.2.md   # Full product specification
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Anonymisation engine (JS)** | Pure JavaScript, ES modules, zero runtime dependencies |
| **Anonymisation engine (Python)** | Python 3.9+ stdlib only (`re`, `unicodedata`, `json`, `math`) |
| **Web app** | SvelteKit v2, Svelte 5 (runes), Vite 7, adapter-static |
| **CSV parsing** | PapaParser (only external dependency) |
| **Testing** | Vitest (JS), pytest (Python) |
| **Hosting** | Any static host (Netlify, Vercel, GitHub Pages, S3) |
| **Randomness** | Mulberry32 seeded PRNG (deterministic, cross-language identical) |
| **Noise model** | Bounded Laplace distribution with grade-boundary awareness |

---

## Core Design Principles

- **Deterministic:** Same seed + same input = identical output, every time, in both JS and Python
- **No native randomness:** All randomness flows through a seeded Mulberry32 PRNG — never `Math.random()` or `random.random()`
- **No native rounding:** All rounding uses `roundHalfAway` — never `Math.round()` or Python `round()`
- **Stateless:** Every call is self-contained. Mapping passed in/out explicitly
- **Synchronous:** No async, no storage, no network calls in the library
- **Cross-language parity:** JS and Python produce byte-identical output for the same seed

---

## Getting Started

### Web App

```bash
cd apps/web
npm install
npm run dev       # Dev server at localhost:5173
npm run build     # Static build → build/
```

Requires Node 22+.

### JS Library

```bash
cd packages/shield
npm install
npm test          # Run 260+ tests
```

```javascript
import Shield from '@djb/shield';

const shield = new Shield({ seed: 42, mode: 'accurate' });

// Anonymise
const result = shield.anonymise({
  headers: ['Name', 'Score', 'Comments'],
  rows: [
    ['Emma Wilson', '78', 'Strong improvement this term'],
    ['James Chen', '92', 'Discussed progress with Mrs Patel']
  ]
});

// result.anonymised  → data with fake names + ID tokens
// result.mapping     → real ↔ fake name mapping
// result.risks       → k-anonymity analysis
// result.flags       → flagged sensitive content ("Mrs Patel" detected)

// De-anonymise AI response
const output = shield.deanonymise(aiResponseText, result.mapping);
// output.text  → real names restored
// output.stats → { idMatches, nameMatches, unmatched }
```

### Python Library

```bash
cd packages/shield-py
pip install -e .
pytest            # Run parity tests
```

```python
from shield import Shield

shield = Shield(seed=42, mode='accurate')

result = shield.anonymise(
    headers=['Name', 'Score', 'Comments'],
    rows=[
        ['Emma Wilson', '78', 'Strong improvement this term'],
        ['James Chen', '92', 'Discussed progress with Mrs Patel']
    ]
)

# Python-only features:
shield_oneway = Shield(seed=42, one_way=True)        # No mapping returned
shield_strip = Shield(seed=42, strip_identifiers=True) # Auto-remove UPN/DOB/postcode columns
```

---

## API Reference

### `new Shield(config)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `seed` | `number` | `Date.now()` | PRNG seed for deterministic output |
| `mode` | `'accurate' \| 'anonymous'` | `'accurate'` | Privacy mode |
| `gender` | `'aware' \| 'neutral'` | `'aware'` | Gender-aware or neutral name assignment |
| `noise.percent` | `number` | `0.05` | Noise as fraction of max value |
| `noise.boundaries` | `number[]` | `[40,50,60,70,80,90]` | Grade boundaries for noise clamping |
| `kThreshold` | `number \| 'auto'` | `'auto'` | k-anonymity threshold (auto: k=5 for <20 rows, k=3 for 20+) |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `anonymise(data, config)` | `{ anonymised, mapping, risks, flags, detected, perturbationFailures }` | Full anonymisation pipeline |
| `deanonymise(text, mapping, options)` | `{ text, unmatched, stats }` | Restore real names in AI output |
| `analyseRisk(data, config)` | `{ kAnonymity, rareCategories, recommendations }` | Standalone risk analysis |
| `scanText(text, config)` | `{ flags, cleaned }` | Scan free text for sensitive content |
| `detectColumns(data)` | `{ columns }` | Auto-classify column types |
| `addNoise(values, config)` | `{ values, perturbationFailures }` | Add bounded Laplace noise |

### De-anonymisation Strategies

| Strategy | Description |
|----------|-------------|
| `id-first` (default) | ID token regex → structured name pass → global name fallback |
| `json` | Parse JSON, walk structure, replace IDs + names |
| `structured-only` | ID + structured pass only, no global fallback |
| `global` | ID pass + boundary-aware global name replacement |

---

## Testing

Both test suites validate against shared fixtures in `test-fixtures/`:

- **`sample-dataset.csv`** — 22 fictitious students with deliberately planted privacy traps (sibling names in comments, medical diagnoses, staff names, location references)
- **`prng-sequence-seed42.json`** — First 100 PRNG values for cross-language verification
- **`anonymised-seed42.json`** — Expected output for regression testing

**Regression test:** All planted privacy traps must be caught with zero misses — this is a blocking test.

```bash
# JS
cd packages/shield && npm test

# Python
cd packages/shield-py && pytest
```

---

## Who Is This For?

- **Teachers** who want to use AI tools with student data without breaching GDPR
- **Schools** looking for a practical, auditable data protection solution
- **Developers** building education tools that handle student data before sending it to AI APIs (use the Python library server-side)

---

## License

UNLICENSED — Private
