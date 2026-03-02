# @djb/shield

Anonymisation library for UK school student data. Replaces real student names with fake names and ID tokens, adds bounded Laplace noise to numeric scores, scans free-text fields for sensitive information, and de-anonymises AI responses back to real names. Zero runtime dependencies, fully deterministic via a seeded PRNG, and produces byte-identical output to its Python port (`shield-py`) given the same seed and input. Runs in the browser and Node.js.

## Installation

```bash
npm install @djb/shield
```

## Quick Start

```js
import { Shield } from '@djb/shield';

// 1. Create a Shield instance with a fixed seed for reproducibility
const shield = new Shield({ mode: 'anonymous', seed: 42 });

// 2. Anonymise student data (CSV string or { headers, rows } object)
const csv = `Name,Gender,Score,Comment
Emily Barker,F,78,Works well with James Chen
James Chen,M,65,Needs support in maths`;

const result = shield.anonymise(csv, { maxValue: 100 });

// result.anonymised  — { headers, rows } with fake names and noised scores
// result.mapping     — lookup table for de-anonymisation
// result.risks       — k-anonymity analysis
// result.flags       — sensitive items found in free-text fields

// 3. Send result.anonymised to an AI, then de-anonymise its response
const aiResponse = `[S01] scored well. [S02] needs additional support.`;
const output = shield.deanonymise(aiResponse, result.mapping);

// output.text     — response with real names restored
// output.stats    — { idMatches, nameMatches, unmatched }
```

## API Reference

### `shield.anonymise(data, config?)`

Full anonymisation pipeline. Detects column types, scans free-text for sensitive data, replaces names, applies noise (in anonymous mode), shuffles rows, and runs risk analysis.

**PRNG consumption order:** name selection, then noise, then shuffle.

```ts
shield.anonymise(
  data: string | { headers: string[], rows: string[][] },
  config?: {
    columns?: Record<number, string>,
    staffNames?: string[],
    nameColIndex?: number,
    genderColIndex?: number,
    numericColIndices?: number[],
    maxValue?: number
  }
): {
  anonymised: { headers: string[], rows: string[][] },
  mapping: Mapping,
  risks: RiskAnalysis,
  flags: Flag[],
  detected: { columns: ColumnInfo[] },
  perturbationFailures: Record<number, number>
}
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `data` | `string \| { headers, rows }` | *required* | CSV string or pre-parsed tabular data |
| `config.columns` | `Record<number, string>` | auto-detected | Column index to type mapping override |
| `config.staffNames` | `string[]` | `[]` | Staff names to add to the blocked-tokens set |
| `config.nameColIndex` | `number` | auto-detected | Index of the student name column |
| `config.genderColIndex` | `number` | auto-detected | Index of the gender column |
| `config.numericColIndices` | `number[]` | auto-detected | Indices of numeric columns to noise |
| `config.maxValue` | `number` | `100` | Maximum value for numeric columns (used for noise scaling) |

**Example:**

```js
const result = shield.anonymise(csvString, {
  staffNames: ['Ms Thompson', 'Mr Davies'],
  maxValue: 100,
});

console.log(result.anonymised.rows[0]); // ['Priya Okonkwo [S14]', 'F', '72', '[REDACTED NAME] works well']
console.log(result.flags);              // [{ type: 'name', value: 'James Chen', ... }]
```

---

### `shield.deanonymise(text, mapping, options?)`

Restores real student names in AI-generated text using the mapping produced by `anonymise()`. Supports four replacement strategies. All text is NFKC-normalised before matching. Names are replaced longest-first to prevent partial matches. Matching is case-insensitive; output always uses the canonical (stored) casing of the real name.

```ts
shield.deanonymise(
  text: string,
  mapping: Mapping,
  options?: {
    strategy?: 'id-first' | 'json' | 'structured-only' | 'global'
  }
): {
  text: string,
  unmatched: string[],
  stats: { idMatches: number, nameMatches: number, unmatched: string[] }
}
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `text` | `string` | *required* | AI response text containing fake names or ID tokens |
| `mapping` | `Mapping` | *required* | The `mapping` object returned by `anonymise()` |
| `options.strategy` | `string` | `'id-first'` | De-anonymisation strategy (see below) |

**Example:**

```js
const output = shield.deanonymise(
  'Priya Okonkwo [S14] achieved 72%. Priya is making good progress.',
  result.mapping
);

console.log(output.text);           // 'Emily Barker achieved 72%. Emily Barker is making good progress.'
console.log(output.stats.idMatches); // 1
```

When using the `json` strategy, the return shape differs if parsing succeeds:

```js
const jsonOutput = shield.deanonymise(jsonString, mapping, { strategy: 'json' });
// On success: { parsed: object, valid: true, stats }
// On parse failure: falls back to id-first, returns { text, valid: false, stats }
```

---

### `shield.analyseRisk(data, config?)`

Analyses re-identification risk using k-anonymity grouping on quasi-identifier columns and rare-category detection with generalisation suggestions.

```ts
shield.analyseRisk(
  data: string[][] | { headers: string[], rows: string[][] },
  config?: {
    quasiIdentifiers?: number[],
    categoricalColumns?: Array<{ index: number, name: string }>,
    kThreshold?: number | 'auto'
  }
): {
  kAnonymity: {
    threshold: number,
    totalStudents: number,
    safeStudents: number,
    flaggedGroups: Array<{
      attributes: Record<string, any>,
      count: number,
      rowIndices: number[]
    }>
  },
  rareCategories: Array<{
    column: number,
    columnName: string,
    value: any,
    count: number,
    suggestion: string | null
  }>,
  recommendations: string[]
}
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `data` | `string[][] \| { headers, rows }` | *required* | Row arrays or parsed data object |
| `config.quasiIdentifiers` | `number[]` | `[]` | Column indices to group by for k-anonymity |
| `config.categoricalColumns` | `Array<{ index, name }>` | `[]` | Columns to check for rare categories |
| `config.kThreshold` | `number \| 'auto'` | constructor value | k=5 for <20 students, k=3 for >=20 (when `'auto'`) |

**Example:**

```js
const risks = shield.analyseRisk(data, {
  quasiIdentifiers: [1, 3, 4],  // gender, SEN, PP columns
  categoricalColumns: [
    { index: 1, name: 'Gender' },
    { index: 3, name: 'SEN' },
  ],
});

console.log(risks.recommendations);
// ['18 of 22 students are in groups of 3+. 4 students have attribute combinations...']
```

---

### `shield.scanText(text, config?)`

Scans free text for sensitive information: student names, staff names, medical/safeguarding/family keywords, dates, UK postcodes, phone numbers, and email addresses. Returns all flagged items with positions and context, plus a cleaned version of the text with redaction placeholders.

```ts
shield.scanText(
  text: string,
  config?: {
    knownNames?: string[],
    staffNames?: string[],
    keywords?: 'default' | { medical: string[], safeguarding: string[], family: string[] },
    extraPatterns?: Array<{ pattern: RegExp | string, type: string }>
  }
): {
  flags: Array<{
    type: string,
    subtype?: string,
    value: string,
    position: number,
    context: string
  }>,
  cleaned: string
}
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `text` | `string` | *required* | Text to scan |
| `config.knownNames` | `string[]` | `[]` | Full names from the class list |
| `config.staffNames` | `string[]` | `[]` | Staff names to flag |
| `config.keywords` | `'default' \| object` | `'default'` | Keyword lists; `'default'` uses the built-in lists |
| `config.extraPatterns` | `Array<{ pattern, type }>` | `[]` | Additional regex patterns to match |

Flag types: `name`, `keyword` (with subtype `medical`, `safeguarding`, or `family`), `date`, `postcode`, `phone`, `email`, `custom`.

**Example:**

```js
const scan = shield.scanText(
  'Emily Barker has ADHD. Contact: parent@email.com, 07700 900123',
  { knownNames: ['Emily Barker', 'James Chen'] }
);

console.log(scan.flags.map(f => f.type));
// ['name', 'keyword', 'email', 'phone']

console.log(scan.cleaned);
// '[REDACTED NAME] has [ADDITIONAL NEEDS]. Contact: [REDACTED EMAIL], [REDACTED PHONE]'
```

---

### `shield.detectColumns(headersOrData, rows?)`

Classifies each column in a dataset as `name`, `numerical`, `categorical`, `free-text`, `date`, or `identifier` (always-sensitive). Uses asymmetric confidence thresholds and header keyword boosting. Recognises UK MIS column headers (Form, House, Set, KS2, FFT, CAT, PP, SEN, EAL, etc.).

```ts
shield.detectColumns(
  headersOrData: string[] | { headers: string[], rows: string[][] },
  rows?: string[][]
): {
  columns: Array<{
    index: number,
    name: string,
    type: string,
    confidence: number,
    sensitive: boolean,
    reviewRequired: boolean
  }>
}
```

Accepts either `(headers, rows)` as two arguments, or a single `{ headers, rows }` object.

| Parameter | Type | Description |
|---|---|---|
| `headersOrData` | `string[] \| { headers, rows }` | Column headers array, or a parsed data object |
| `rows` | `string[][]` | Row arrays (only when first argument is a headers array) |

Confidence thresholds (below these, `reviewRequired` is `true`):

| Type | Threshold |
|---|---|
| `name` | 90% |
| `free-text` | 85% |
| `date` | 80% |
| `numerical` | 75% |
| `categorical` | 75% |

**Example:**

```js
const detection = shield.detectColumns(
  ['Name', 'Gender', 'Maths Score', 'UPN', 'Teacher Comment'],
  rows
);

detection.columns.forEach(col => {
  console.log(`${col.name}: ${col.type} (${col.confidence * 100}%) ${col.sensitive ? 'SENSITIVE' : ''}`);
});
// Name: name (95%)
// Gender: categorical (85%)
// Maths Score: numerical (90%)
// UPN: identifier (0%) SENSITIVE
// Teacher Comment: free-text (88%)
```

---

### `shield.addNoise(values, config?)`

Applies bounded Laplace noise to an array of numeric values. Non-numeric values (e.g. `"Absent"`) pass through unchanged. When grade boundaries are provided, noised values are clamped within their original grade band. Values in narrow bands (only one possible integer) are returned unchanged and flagged as perturbation failures.

```ts
shield.addNoise(
  values: Array<number | string>,
  config?: {
    maxValue?: number,
    percent?: number,
    boundaries?: number[]
  }
): {
  values: Array<number | string>,
  perturbationFailures: number
}
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `values` | `Array<number \| string>` | *required* | Column values to noise |
| `config.maxValue` | `number` | `100` | Maximum value in the scale |
| `config.percent` | `number` | `0.05` | Noise as a fraction of maxValue (0.05 = 5%) |
| `config.boundaries` | `number[]` | `null` | Grade boundary array, e.g. `[40, 50, 60, 70, 80, 90]` |

**Example:**

```js
const shield = new Shield({ seed: 42 });
const { values, perturbationFailures } = shield.addNoise(
  [72, 85, 43, 'Absent', 91],
  { maxValue: 100, percent: 0.05, boundaries: [40, 50, 60, 70, 80, 90] }
);

console.log(values);               // [74, 83, 44, 'Absent', 92]
console.log(perturbationFailures); // 0
```

## Constructor Options

```js
const shield = new Shield({
  mode: 'anonymous',
  seed: 42,
  noise: { percent: 0.05, boundaries: [40, 50, 60, 70, 80, 90] },
  gender: 'aware',
  kThreshold: 'auto',
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `'accurate' \| 'anonymous'` | `'accurate'` | Privacy mode (see Privacy Modes below) |
| `seed` | `number` | `Date.now()` | Seed for the Mulberry32 PRNG. Use a fixed seed for reproducible output. |
| `noise` | `object` | `{ percent: 0.05 }` | Noise configuration for anonymous mode |
| `noise.percent` | `number` | `0.05` | Noise as a fraction of maxValue |
| `noise.boundaries` | `number[]` | `undefined` | Grade boundary array for boundary-aware noise |
| `gender` | `'aware' \| 'neutral'` | `'aware'` | Gender mode for fake name assignment |
| `kThreshold` | `number \| 'auto'` | `'auto'` | Fixed k-anonymity threshold, or `'auto'` for scaled threshold |

## De-anonymisation Strategies

The `deanonymise` method supports four strategies, selected via `options.strategy`:

### `id-first` (default)

The recommended strategy. Runs three passes in sequence:

1. **ID pass** -- replaces `[S01]` tokens and `FakeName [S01]` combined patterns with real names.
2. **Structured pass** -- replaces fake names inside markdown tables (columns headed Student/Name/Pupil) and `Student: FakeName` prefix lines.
3. **Global pass** -- replaces any remaining fake names anywhere in the text using boundary-aware, case-insensitive, longest-first matching.

Best for most AI outputs (prose, markdown tables, mixed formats).

### `json`

Parses the text as JSON, walks the entire structure recursively, and replaces ID tokens and fake names in every string value. Returns `{ parsed, valid: true, stats }` on success. Falls back to `id-first` if JSON parsing fails, returning `{ text, valid: false, stats }`.

Best for structured AI outputs requested in JSON format.

### `structured-only`

Runs the ID pass and structured pass only. Skips the global name replacement pass entirely. Use this when you want conservative replacement and can tolerate some fake names remaining in prose sections.

### `global`

Runs the ID pass followed by a global boundary-aware name replacement across the entire text. Skips the structured pass. Use this when the output is unstructured prose with no tables or labelled sections.

## Data Formats

### Mapping Object

Returned by `anonymise()` and consumed by `deanonymise()`. Do not modify this object.

```js
{
  ids: {
    'S01': 'Emily Barker',    // ID token → real name
    'S02': 'James Chen',
  },
  names: {
    'Priya Okonkwo': 'Emily Barker',  // fake name → real name
    'Ravi Mbeki': 'James Chen',
  },
  nameToId: {
    'Priya Okonkwo': 'S01',   // fake name → ID token
    'Ravi Mbeki': 'S02',
  },
  idToFake: {
    'S01': 'Priya Okonkwo',   // ID token → fake name
    'S02': 'Ravi Mbeki',
  }
}
```

### Anonymised Output

```js
{
  anonymised: {
    headers: ['Name', 'Gender', 'Score', 'Comment'],
    rows: [
      ['Ravi Mbeki [S02]', 'M', '67', '[REDACTED NAME] needs support'],
      ['Priya Okonkwo [S01]', 'F', '76', '[REDACTED NAME] works well'],
    ]
  },
  mapping: { /* see above */ },
  risks: { /* see analyseRisk return value */ },
  flags: [
    { type: 'name', value: 'James Chen', position: 16, context: '...works well with James Chen', rowIndex: 0, colIndex: 3 }
  ],
  detected: {
    columns: [
      { index: 0, name: 'Name', type: 'name', confidence: 0.95, sensitive: false, reviewRequired: false },
      // ...
    ]
  },
  perturbationFailures: {}  // { colIndex: failureCount } — only in anonymous mode
}
```

### Risk Analysis Output

```js
{
  kAnonymity: {
    threshold: 3,
    totalStudents: 22,
    safeStudents: 18,
    flaggedGroups: [
      { attributes: { col1: 'F', col3: 'K' }, count: 2, rowIndices: [5, 14] }
    ]
  },
  rareCategories: [
    { column: 3, columnName: 'SEN', value: 'K', count: 1, suggestion: 'SEN Support' }
  ],
  recommendations: [
    '18 of 22 students are in groups of 3+. 4 students have attribute combinations shared by fewer than 3 others.',
    'Rare category in "SEN": "K" appears only 1 time. Consider generalising to "SEN Support".'
  ]
}
```

## Privacy Modes

### `accurate` mode

Names are replaced with fake names and ID tokens. Rows are shuffled. Free-text is scanned and redacted. **Numeric values are left unchanged.** Use this when you need the AI to work with real scores (e.g. identifying which students need intervention based on exact marks).

### `anonymous` mode

Everything in accurate mode, plus **bounded Laplace noise** is added to numeric columns. Noised values are rounded to integers, clamped within grade bands (if boundaries are provided), and clamped to the valid range `[0, maxValue]`. Use this when numeric values themselves could be identifying (e.g. a unique score of 17% in a small class).

Noise characteristics:
- Distribution: Laplace (not Gaussian)
- Scale parameter: `b = maxValue * noisePercent / 2`
- Bounded: noised values are clamped within `+/- maxValue * noisePercent` of the original
- Grade-boundary aware: noised values stay within the same grade band as the original
- Integer rounding reduces fingerprintability
- Narrow-band safety: if a grade band contains only one possible integer value, the original value is returned unchanged and counted in `perturbationFailures`
- A noised value may equal the original -- this is correct Laplace behaviour

## Critical Constraints

These rules are enforced across the codebase and are essential for cross-language parity:

1. **No `Math.random()`** -- all randomness flows through the Mulberry32 seeded PRNG. This ensures deterministic, reproducible output.

2. **No `Math.round()`** -- all rounding uses `roundHalfAway()` (round half away from zero). JavaScript's `Math.round()` rounds 0.5 up, while Python's `round()` uses banker's rounding. `roundHalfAway` eliminates this divergence.

3. **PRNG consumption order is fixed** -- name selection, then noise, then shuffle. Both JS and Python consume PRNG values in this exact sequence. Changing the order breaks cross-language parity.

4. **Cross-language parity with `shield-py`** -- given the same seed and input, the JS and Python libraries produce byte-identical output. Shared test fixtures in `test-fixtures/` validate this.

5. **Zero runtime dependencies** -- the library uses no external packages. Papa Parse is optional for CSV parsing convenience but is not required.

6. **Stateless design** -- every call is self-contained. The mapping is passed in and out explicitly. No global state, no singletons.

7. **Synchronous, in-memory processing** -- no async operations, no storage calls, no network calls.

## Testing

The test suite uses Vitest:

```bash
cd packages/shield
npm install       # install dev dependencies (vitest)
npm test          # run all tests
npm run test:watch  # run in watch mode
```

Test coverage includes:
- PRNG sequence verification (first 100 values for known seeds)
- Rounding edge cases
- Deterministic anonymisation output for fixed seeds
- Blocked-token collision detection
- Noise boundary cases, narrow-band safety, range clamping
- Scanner detection of all planted privacy traps in the sample dataset
- De-anonymisation with various AI output formats (tables, JSON, prose, curly quotes, possessives, all-caps)
- k-Anonymity calculations and rare-category detection
- Column type detection for common UK school export formats
- Full anonymise-then-deanonymise round-trip tests
