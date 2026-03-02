# PupilSafe AI for Teachers — Product Design Document v2.2

**Author:** Dom Barker
**Date:** March 2026
**Version:** 2.2 — Revised following technical audit: ID-based de-anonymisation, JSON output for structured templates, noise engine fix, scaled k-anonymity, asymmetric confidence thresholds, Stripe invoice fallback, sample dataset regression test
**Status:** Ready for build

---

## Executive Summary

PupilSafe AI is a browser-based tool that lets UK secondary school teachers use AI assistants (ChatGPT, Claude, Gemini) with student data — safely and legally. It anonymises student data before it reaches any AI, generates effective prompts for common teaching tasks, and de-anonymises the AI's response so teachers get real, usable output.

> **Core Promise:** Paste your class data. Get AI-powered insights. Student names never leave your browser.

All processing runs entirely in the teacher's browser. There is no backend, no database, and no server. Student data is never transmitted anywhere.

**Target user:** UK secondary school teachers who want to use AI but are told (correctly) that they must not paste student data into public AI tools. Currently 60% of UK teachers use AI, but 76% have received no data protection training. This tool bridges that gap.

**Revenue target:** £100/month passive income (≈50 paying users at £2/month or ≈80 at £15/year).

**Tech stack:** 100% client-side Svelte compiled to static JS. Hosted free on Netlify or Vercel. Stripe for payments. Total running costs approximately £10/month.

---

## Marketing Principle: Lead with Speed, Not Privacy

This is the single most important insight for the entire product. Privacy is the permission slip. Speed is the hook.

The landing page, the demo video, the launch tweets, every piece of marketing should lead with the outcome: **"Paste your marksheet. Get intervention groups and report comments in 60 seconds."** Privacy is what makes teachers *willing* to try it. The 60-second round-trip is what makes them *want* to.

The demo video showing a full round-trip — real-looking data in, anonymised prompt copied, AI response pasted back, de-anonymised output ready to use — is probably worth more than the entire landing page copy. Record it as a Loom, keep it under 90 seconds, embed it above the fold. A sample "Assessment → Intervention groups" before/after with a realistic marksheet is the "I get it in 10 seconds" moment.

Everything else on the landing page exists to support this demo. The privacy architecture page, the school policy one-pager, the open-source engine — those are for the teacher who's already interested and needs to convince their head of department. The demo is for the teacher who hasn't decided to care yet.

---

## The Problem

UK teachers face a genuine bind. AI is incredibly useful for report writing, data analysis, differentiated resources, progress tracking, and student feedback. But student data is legally protected under UK GDPR, with fines of up to £17M or 4% of global turnover for breaches. School policies explicitly prohibit pasting student names, grades, SEN status, or behaviour data into public AI tools. GOV.UK guidance says "avoid including any identifiable information in the data you enter into open AI tools" — but provides zero tools to help teachers actually do this.

Teachers also lack prompting skills. Even if they could safely use AI, many don't know how to write effective prompts for educational tasks.

The result: teachers either don't use AI (missing productivity gains) or quietly paste student data into ChatGPT anyway (risking GDPR violations and their careers).

---

## The Solution

A three-part tool that runs entirely in the browser.

### 1. Shield — Anonymise Data

The teacher pastes or uploads their class data. The tool automatically detects student names and replaces them with randomly generated plausible names (fresh every session). Depending on the chosen mode, it either preserves numerical data exactly or adds bounded statistical noise. It shuffles row order. It scans free-text fields (teacher comments, notes) for identifying information and flags it for review. The mapping is stored locally in the browser. Nothing is transmitted anywhere.

### 2. Prompt — Generate Effective Prompts

The teacher selects a task from a curated menu: analyse class performance, write report comments, generate differentiated questions, identify intervention groups, draft parent communication, and more. The tool asks a few targeted follow-up questions, then generates a complete, well-structured prompt incorporating the anonymised data.

### 3. Translate — De-anonymise the Response

The teacher pastes the AI's response back into the tool. It reverses the name substitutions and presents the final, real-names output ready for the teacher to use.

**De-anonymisation by design:** Rather than relying solely on fake name matching (which is brittle against AI models that abbreviate, correct spelling, swap to pronouns, or reformat), the tool uses a dual-key approach: **stable IDs as the primary de-anonymisation key, with fake name matching as a fallback.**

Every student in the anonymised dataset is assigned both a fake name (for human readability in the AI's output) and a short stable ID token (for machine-reliable replacement). The anonymised data sent to the AI looks like:

```
| Student | ID | Score | SEN |
|---------|------|-------|-----|
| Alex Carter | [S01] | 72 | No |
| Priya Okonkwo | [S02] | 45 | K |
```

The prompt instructs the AI to include the `[SXX]` token whenever it refers to a student. De-anonymisation then works in two passes:

1. **ID pass (primary):** Regex match `[S01]`, `[S02]` etc. and replace with real names. These tokens are short, distinctive, and models preserve them reliably. This handles ~95% of replacements.
2. **Name pass (fallback):** For any fake names that appear without an accompanying ID (e.g. in free-form prose where the model dropped the token), fall back to the structured-first name matching strategy.

The teacher never sees the IDs — the UI strips them after replacement. The final output contains only real names in natural text. This makes the "exact-match token rule" almost irrelevant as a reliability concern, because the IDs do the heavy lifting.

Every generated prompt includes five key instructions:

**Instruction 1 — Always include student IDs:**

> "Every student has an ID in square brackets (e.g. [S01]). When referring to any student, always include their ID. For example: 'Alex Carter [S01] should be moved to the intervention group.' Never refer to a student without their ID."

**Instruction 2 — Full names always (explicit prohibitions):**

> "When referring to any student, always use their full name (first name and surname) every time. Never use any of the following: first name only, surname only, initials (e.g. 'J.C.'), abbreviated forms (e.g. 'James C.'), or pronouns without the full name and ID in the same sentence."

**Instruction 3 — Structured output format:**

> "When producing per-student output, use a table with 'Student' and 'ID' columns. If a table is not appropriate, prefix each student section with 'STUDENT: [Full Name] [ID]' on its own line."

**Instruction 4 — No invented names:**

> "Use only the student names and IDs provided in the dataset. Do not invent, fabricate, or introduce any names or IDs that are not in the data. If you need to refer to a hypothetical student, use 'Student X' or 'a student', never a plausible human name."

**Instruction 5 — Exact-match token rule:**

> "Copy student names and IDs exactly as provided. Do not correct spelling, add middle names, change capitalisation, or alter spacing or hyphenation. The names and IDs must appear in your output character-for-character identical to how they appear in the input data."

Instruction 5 matters because AI models love "fixing" names — capitalising differently, expanding "Li" to "Lee", inserting spaces in hyphenated names, or "correcting" unusual spellings. Any of these changes would break name-only matching. But with IDs as the primary key, these mutations are a cosmetic issue rather than a functional failure — the ID `[S07]` is still there even if the model mangled the name next to it.

The dual-key approach dramatically reduces de-anonymisation edge cases. The ID pass handles the vast majority of replacements mechanically and reliably. The name pass mops up any remaining instances where the model dropped an ID token. Instead of every AI formatting quirk being a potential failure, only the rare case where a model drops *both* the ID and mangles the name causes an unmatched token — and even then, the partial-match safety net flags it for teacher review.

**Replacement approach — dual pass:**

**Pass 1 — ID replacement (primary):** Regex match all `[SXX]` tokens in the AI output. Each token maps directly to a real student name. Replace `[S01]` with the real name, including the surrounding fake name if present (e.g. "Alex Carter [S01]" → "James Chen"). The ID regex is simple and robust: `\[S\d{2,3}\]` — square brackets make it distinctive enough to avoid false matches in natural text.

**Pass 2 — Name replacement (fallback):** After the ID pass, scan for any remaining fake names that weren't accompanied by an ID token. Apply the structured-first name matching strategy (see De-anonymisation Strategy below). This catches cases where the model referred to a student by fake name only without the ID.

**General replacement rules (apply to both passes):** Normalise all text to Unicode NFKC before matching (collapses curly quotes and other variants). Use boundary-aware regex that treats punctuation as word boundaries. Replace longest names first to prevent partial overlaps (e.g. "James Chen" before "James"). **Canonical-case replacement:** use case-insensitive matching but always replace with the real name in its correct canonical casing. Don't attempt to preserve the output casing — "JAMES CHEN" becomes "James Chen", not "JAMES CHEN" with the real name in all-caps. Teachers won't care, and case-preserving replacement is complex to implement correctly across all edge cases.

**De-anonymisation strategy ordering (critical):** The library's `deanonymise()` function defaults to `id-first` strategy. This means:

1. **ID replacement first.** Scan the entire text for `[SXX]` tokens. Replace each token (and its accompanying fake name if adjacent) with the real student name. This is the highest-confidence pass — IDs are unambiguous and don't suffer from spelling, casing, or abbreviation issues.
2. **Structured name replacement second.** For any remaining unmatched fake names, detect tables with a Student/Name column → replace names only within those cells. Detect `STUDENT: FakeName` lines → replace only the name portion. These are high-confidence, low-risk replacements because the name is in a predictable position.
3. **Global name replacement third (fallback only).** Only after ID and structured replacement are complete, scan for any remaining unmatched fake names and do boundary-aware global replacement. This catches names that appear in prose, summaries, or other unstructured sections without an ID.
4. **Never global-first.** Global replacement before ID and structured replacement risks collateral damage.

The `structured-only` strategy (available for server-side pipelines) skips step 3 entirely — any name not matched by ID, table cell, or STUDENT: line is flagged as unmatched rather than replaced. This is the safest option when no human reviews the output.

**Replacement robustness:** Even with ID tokens and structured output instructions, the engine must handle:

- `[S01]` with surrounding whitespace variations
- Fake names appearing without IDs (model dropped the token)
- `Fake Name,` and `Fake Name.` (trailing punctuation treated as boundary)
- `Fake Name's` and `Fake Name's` (both straight and curly apostrophes)
- `FAKE NAME` (all-caps in headers or tables — matched case-insensitively)
- `"Fake Name"` (quoted names)
- Mixed whitespace and line breaks

**Fallback handling:** If the AI ignores the ID instruction (rare but possible), the name-matching fallback handles it. If both ID and name matching fail for a token, the tool highlights it with a "we couldn't match this — please check" warning. But with IDs as primary key, this should be extremely rare — in testing, models preserve short bracketed tokens like `[S07]` with near-perfect reliability.

### Machine-Parsable Output for Analysis Templates

For analysis templates (intervention groups, performance trends, groupings, comparison), relying on the AI to produce well-formatted prose or markdown tables is a source of brittleness. Models reformat tables into bullet lists, add unexpected headers, or produce inconsistent structures that break parsing.

**Solution: force JSON output for structured templates, with validation and auto-repair.**

**Which templates use JSON output:**

| Template type | Output format | Why |
|---------------|--------------|-----|
| Analyse Class Performance | JSON | Returns structured groups, statistics, recommendations |
| Identify Students for Intervention | JSON | Returns student lists with criteria |
| Compare Performance Across Assessments | JSON | Returns tabular comparison data |
| Suggest Collaborative Groupings | JSON | Returns group assignments |
| Plan Seating Based on Data | JSON | Returns seating arrangement |
| Write Report Comments | Prose with IDs | Teachers need natural language, not data structures |
| Draft Parent Communication | Prose with IDs | Natural language required |
| Generate Differentiated Questions | Prose with IDs | Questions need to read naturally |
| Write UCAS/Reference Material | Prose with IDs | Natural language required |

**How JSON output works:**

1. The prompt includes a JSON schema specifying the exact structure expected:

```
Respond with ONLY valid JSON matching this schema, no other text:
{
  "groups": [
    {
      "name": "string (group label)",
      "students": [
        { "id": "string (e.g. S01)", "name": "string", "reason": "string" }
      ],
      "recommendation": "string"
    }
  ],
  "summary": "string"
}
```

2. The tool attempts to parse the AI response as JSON.
3. **If parsing succeeds:** De-anonymise by walking the parsed structure and replacing IDs and fake names with real names. Render as a formatted table or card layout in the UI. Clean, reliable, zero edge cases.
4. **If parsing fails:** Show a "The AI didn't return valid data. Retrying..." message and automatically send a repair prompt: "Your previous response was not valid JSON. Here is what you returned: [truncated output]. Please return ONLY valid JSON matching the schema provided." Models are good at self-correction when told exactly what went wrong.
5. **If repair also fails:** Fall back to the text-based de-anonymisation strategy (ID pass → name pass) and show the raw output with a note: "We couldn't parse this as structured data. We've replaced names where possible — please review."

**Why this matters for retention:** If teachers have to manually fix de-anonymisation errors in every session, they'll stop using the tool within a week. JSON output for analysis templates eliminates the entire class of formatting-related failures. The teacher pastes into the AI, pastes back, and sees a clean table with real names. Every time. The "it just works" experience is what drives repeat use.

**Prose templates stay prose:** For report writing and parent communication, forcing JSON would be unnatural — the teacher wants paragraphs, not data structures. These templates use the ID-keyed approach: the AI writes natural prose with `[SXX]` tokens embedded, and the ID pass replaces them reliably regardless of how the model phrased the surrounding text. The name-matching fallback handles any dropped IDs.

---

## Privacy Architecture

The anonymisation engine applies multiple independent privacy layers. Each layer adds protection; together they make re-identification practically impossible from the data sent to an AI.

**Threat model:** PupilSafe AI reduces identifiability risk when data is shared with an AI provider. It does not prevent re-identification by someone who already has the original dataset and strong auxiliary information (e.g. a colleague who recognises score patterns from the original spreadsheet). The tool protects against accidental GDPR exposure via AI tools — not against a motivated adversary with access to the source data.

### Two Privacy Modes

This is the key design decision. Teachers face a fundamental trade-off: more accurate data means better AI analysis, but more privacy means less risk. Rather than hiding this trade-off behind a single slider, PupilSafe AI makes it explicit with two clearly distinct modes.

#### 🔍 Accurate Mode — "Names changed. Numbers exact."

**What it does:**

- Replaces all student names with random plausible names (rotating every session)
- Shuffles row order
- Scans free-text fields for identifying information
- **Leaves all numerical data untouched**

**When to use it:**

- The teacher needs precise analysis (e.g. "which students scored below 40%?", "what's the exact mean and standard deviation?", "rank students by performance")
- The data doesn't contain particularly sensitive information beyond names and scores
- The teacher trusts that names-changed + rows-shuffled is sufficient for their context

**What the teacher sees:**

> **Accurate Mode** — Student names are replaced and rows are shuffled. Your scores, grades, and percentages are sent to the AI exactly as they are. Use this when you need precise analysis and your data isn't highly sensitive.

**Small cohort detection:** If the dataset contains fewer than 15 students, the tool automatically surfaces a prominent banner: "Small class detected. With fewer than 15 students, unique score patterns and categories (SEN, gender) can be identifying even without names. We recommend Anonymous Mode for this dataset." The banner nudges toward Anonymous Mode but does not force it. In UK secondary, many sets are 6–12 students, so this will trigger frequently and appropriately.

**Trade-off:** If someone with access to the original class list and the AI conversation could theoretically match students by their exact scores, this mode doesn't prevent that. In practice, this requires a motivated adversary with access to both datasets, which is not the threat model for most teacher use cases.

#### 🔒 Anonymous Mode — "Names changed. Numbers shifted."

**What it does:**

- Everything in Accurate Mode, plus:
- Adds bounded, calibrated statistical noise to all numerical values
- Applies grade-boundary awareness to prevent scores from crossing key thresholds
- Optionally separates attributes into separate fragments (paid tier)

**When to use it:**

- The data includes sensitive categories (SEN status, behaviour records, pupil premium, safeguarding notes)
- The teacher wants maximum protection even at the cost of some analytical precision
- The data will be used for pattern-level analysis rather than individual-level precision (e.g. "what trends do you see?" rather than "list everyone who scored below 40%")

**What the teacher sees:**

> **Anonymous Mode** — Student names are replaced, rows are shuffled, and all scores are shifted by a small random amount. The AI can still see overall patterns and trends, but no individual score is exact. Use this for sensitive data or when you want maximum privacy.

**Trade-off:** Individual scores may be off by a few points. The AI may misclassify borderline students. Precise per-student recommendations become less reliable. Class-level analysis (trends, distributions, correlations) remains accurate.

#### Mode Selection UX

The mode selector appears immediately after the teacher uploads their data and before any processing happens. It's a simple two-option toggle with a one-sentence description of each. The default is **Accurate Mode** (because most teachers need precise analysis, and name replacement alone is sufficient for most GDPR risk). Anonymous Mode is clearly available but not pushed — teachers who need it will know they need it.

**Sensitive-data modal nudge:** If the column detection or free-text scanner detects high-sensitivity terms or columns (EHCP, LAC, exclusions, safeguarding keywords, behaviour notes, medical terms), the tool shows a **modal** (not a banner — banners get ignored) before processing begins:

> "Sensitive categories detected in your data. We recommend one of the following:"
>
> **[Switch to Anonymous Mode]** — scores will be shifted to prevent re-identification
>
> **[Remove sensitive columns]** — we'll strip [column name] before anonymising
>
> **[Continue in Accurate Mode]** — I understand the risk and want exact numbers

The teacher must choose one option to proceed. This creates a clear "teacher chose to proceed" moment — they can't accidentally send sensitive data in Accurate Mode without actively acknowledging it. The modal only triggers for high-sensitivity terms, not for every dataset.

---

### Layer 1: Rotating Random Names (Both Modes)

Every anonymisation session generates fresh, plausible names from a diverse name bank. The same real student will be assigned different fake names in different sessions. The AI never sees the same fake name twice for the same real student.

**Implementation:** A curated bank of approximately 500 first names and 500 surnames, culturally diverse and gender-balanced, reflecting UK school demographics. Random selection with no repetition within a session. The mapping table is stored in browser sessionStorage.

**Collision detection — blocked tokens policy:** The generator maintains a session-level "blocked tokens" set. Any fake name whose first name or surname appears in this set is rejected and regenerated. The blocked set includes:

1. **All real student names** — both first names and surnames, individually. If "James Chen" is a real student, both "James" and "Chen" are blocked as fake-name components.
2. **All tokens flagged in free-text scanning** — teacher names mentioned in comments ("Mrs Henderson"), sibling names ("Emily"), location names that happen to be surnames ("Snowdonia" won't match, but "Richmond" could), medical professionals ("Dr Patel").
3. **Staff names detected in column headers or data** — if a "Teacher" or "Tutor" column exists, all names in that column are added to the blocked set.
4. **Any surname from the class list that appears as a word in free-text fields** — catches the case where a teacher writes "the Barker family" and the fake bank generates "Barker" as someone else's fake surname.

This is a superset of the basic "fake ≠ real" check. It prevents:
- A fake surname colliding with a real teacher's name in comments
- A fake first name matching a sibling mentioned in a comment
- De-anonymisation corrupting narrative text that mentions real people by surname
- The AI output containing "Henderson" (a fake name) being de-anonymised into a real student's name when "Mrs Henderson" appears in the original comments

The blocked set is built once during the anonymisation step (after column detection and free-text scanning) and used for all name generation in that session.

**Gender and pronouns:** Gender handling varies by task. In most use cases (data analysis, intervention groups, differentiated questions), gender is irrelevant unless the teacher specifically wants to analyse gender patterns. Only in report writing does the AI need to produce gendered output. The design reflects this.

**How much does gender de-anonymise data?** In a class of 30 with a roughly even split, knowing gender halves the anonymity set — a named score could belong to ~15 students instead of ~30. In a class of 8 with 2 girls, knowing gender reduces the anonymity set to 2 — a serious re-identification risk. Gender becomes especially dangerous when combined with other attributes (SEN, pupil premium, EHCP) that further narrow the set.

**Tiered risk model:**

| Risk level | Conditions | Behaviour |
|-----------|------------|-----------|
| **Low** (gendered output OK) | Cohort ≥ 20, data is mostly attainment/effort, no sensitive categories, no safeguarding/medical/behaviour free-text, no rare labels | Gender selection available. No warnings. |
| **Medium** (allow, but warn) | Cohort 12–19, or some extra flags (PP, SEN category codes) but no heavy notes | Gender selection available. Banner: "Gender can make students easier to re-identify in smaller datasets. Consider neutral language." |
| **High** (default to neutral, require explicit override) | Cohort < 12, or any safeguarding/medical/behaviour terms detected, or any rare-category columns present (EHCP, LAC, exclusions) | Defaults to they/them. Teacher can override but must acknowledge a warning: "This dataset is small or contains sensitive categories. Including gender significantly increases re-identification risk." |

**Implementation per template type:**

1. **Report writing template:** Asks the teacher to select pronouns for each student (he/him, she/her, they/them) via a fast bulk-edit UI. This is the only template where gendered output matters. Gender selections are used solely to assign appropriately gendered fake names — the gender data itself is never sent to the AI. The tiered risk model applies: if the dataset triggers Medium or High risk, the UI nudges or defaults to neutral.

2. **Analysis templates:** Gender selection is off by default. If the teacher toggles "Analyse gender patterns," the tool includes a gender column in the anonymised data. The tiered risk model applies. When off, no gender information is included in the anonymised data at all.

3. **All other templates:** Gender is not relevant and is not included.

**Neutral-language fallback:** A one-click "Use they/them for everyone" mode is always available and acts as the best privacy lever. When active, the prompt instructs the AI to use they/them throughout, no gender data is sent, and no gendered fake names are assigned. This prevents the AI transcript from leaking gender information even if the teacher makes a mistake elsewhere.

**Name bank structure:** The bank is split into male names (~250), female names (~250), and gender-neutral names (~50), each with ~500 surnames. When gendered output is enabled, the tool assigns fake names matching the student's selected gender. When neutral, all students get gender-neutral fake names.

### Layer 2: Bounded Statistical Noise (Anonymous Mode Only)

All numerical values (test scores, percentages, attendance figures) have calibrated random noise added before being sent to AI. This noise is bounded and context-aware, designed to preserve analytical usefulness while preventing exact individual values from being recoverable.

#### Noise Calibration by Data Type

| Data Type | Noise Range | Rationale |
|-----------|------------|-----------|
| Test scores (0–100) | ±3–5 points | AI can still identify high/low performers and trends. Exact score not recoverable. |
| Percentages / attendance | ±1–2% | Preserves patterns. Tight enough for meaningful analysis. |
| Raw marks (variable range) | ±3–5% of range | Scales to the assessment. A score out of 20 gets less absolute noise than a score out of 200. |

All noised values are clamped to valid ranges (e.g. 0–100 for percentages). Noise is generated using draws from a Laplace distribution, providing a sound statistical basis without requiring formal differential privacy guarantees. Importantly, the noised value is allowed to equal the original — this is the natural behaviour of a genuine Laplace draw and forcing it to differ would constitute an information leak (an adversary who knows the tool never returns the original can rule out one candidate value).

#### Grade-Boundary Awareness (Optional)

A key risk with naive noise is that a student at 39% could be shifted to 41% (or vice versa), flipping them across a pass/fail boundary. When enabled, the noise engine constrains noise to stay within the student's current grade band rather than using a resample loop.

**Implementation:** Determine the student's current band (e.g. 30–39 for a student at 37%). Apply bounded noise within that band only. This is simpler to implement and test than the resample approach (which can produce subtle distribution artifacts at boundaries), and achieves the same goal: no student crosses a grade boundary.

This feature is presented as an optional toggle within Anonymous Mode: "Preserve grade bands (recommended for reports)." It is on by default. Teachers who want pure random noise can disable it.

> **This is a key differentiator.** A teacher could do Find & Replace on names in a spreadsheet. They cannot apply grade-boundary-aware statistical noise. This feature alone justifies using the tool over manual name swapping.

#### What This Preserves vs. What It Destroys

| Preserved | Destroyed |
|-----------|-----------|
| Relative ordering of students (top performers stay near the top) | Exact individual scores (any single value could be off by a few points) |
| Class-level statistics (mean, spread, distribution shape) | Precise gaps between similarly-performing students |
| Correlations between variables (e.g. SEN vs performance) | The ability to reconstruct original data from the noisy version |
| Outlier detection (students far from the mean remain visible) | |
| Grade-band membership (students stay in their grade category) | |

### Layer 3: Row Shuffling (Both Modes)

Rows are randomly permuted using a Fisher-Yates shuffle. The seed is stored locally for reversal. This prevents positional correlation across sessions — "the student in row 3" doesn't map to the same person each time.

### Layer 4: Free-Text Scanning (Both Modes)

This is the most valuable layer and the strongest differentiator from simple Find & Replace. Teacher comments and notes are the most dangerous data, because a comment like "Johnny's mother Mrs Smith called to discuss his ADHD diagnosis and the incident on the Year 9 trip to Thorpe Park" contains a name, a family relationship, a medical condition, a year group, and a specific event — all identifying even without the name column.

#### What the Scanner Detects (MVP)

- Names from the class list appearing in free-text columns, including partial matches (surname only, first name only)
- Family relationship words (mother, father, brother, sister, parent, guardian, mum, dad, carer, step-parent)
- Medical and SEN terminology (ADHD, autism, dyslexia, EHC plan, diagnosed, medication — see Appendix D for full list)
- Safeguarding terminology (social services, CAMHS, looked-after, child protection — see Appendix D)
- Regex patterns: dates (dd/mm/yyyy and variants), UK postcodes, phone numbers, email addresses

Capitalised-word flagging (flagging any remaining capitalised words not already matched) was considered for MVP but deferred. It's the lowest-value, highest-false-positive feature in the scanner stack — teachers get more value from the keyword-based catches being solid than from a noisy "you might want to check this" on every capitalised word in their comments. Moved to post-MVP.

The scanner deliberately does not attempt to detect arbitrary proper nouns "not in a standard dictionary." This approach was considered but rejected for MVP — it requires a large dictionary, produces frequent false positives on unusual common words, and misses place names that happen to be common words (e.g. "Bath", "Reading", "March"). The keyword lists and regex patterns catch the most dangerous categories; the teacher's review step handles anything that slips through.

#### Post-MVP Scanner Improvements

- Improved proper noun detection with a curated UK place-name list
- Detection of school-specific terminology (house names, form groups, teacher initials)
- Learning from teacher corrections (if a teacher frequently flags a particular term, add it to the keyword list locally)

#### How It Works

The scanner uses a combination of pattern matching, keyword lists, and simple heuristics. It does not use NLP or machine learning. Flagged items are highlighted in the UI and the teacher confirms each one before the tool replaces them with generic alternatives (e.g. "a parent called to discuss their additional needs and a recent school trip").

> **Important framing:** The scanner is presented as a helper, not a filter. The UI says "We've flagged potential identifying information for your review" — not "We've removed all identifying information." The teacher is always the final reviewer. This is critical for managing liability.

**"What to look for" checklist:** Above the flagged text in the review UI, show a short checklist reminding the teacher what the scanner might miss:

> Before you proceed, check your text for:
> - ☐ Place names and trip destinations
> - ☐ Staff names or initials
> - ☐ Sibling names
> - ☐ Specific diagnoses or medications
> - ☐ Dates of unique incidents
> - ☐ Anything else that could identify a student in context

This is cheap to implement and massively reduces the risk of teachers assuming the scanner is smarter than it is. The biggest danger with any scanning tool is false confidence — the checklist keeps the teacher actively engaged in the review.

### Layer 5: Re-identification Risk Analysis (Both Modes)

This is where PupilSafe AI goes beyond mechanical transformation and actually reasons about whether the anonymised data is safe. Most anonymisation tools — including every competitor in the teacher space — just swap names and hope for the best. PupilSafe AI analyses the dataset for re-identification risk before anything leaves the browser.

#### k-Anonymity Checking

After anonymisation but before the teacher copies anything, the tool checks: for every student in the dataset, how many other students share the same combination of key categorical attributes?

**Default quasi-identifier set:** The k-anonymity check only groups by a defined set of quasi-identifiers by default, not every categorical column. Grouping by all columns produces combinatorial explosion with messy school exports, leading to banner fatigue where every student gets flagged. The defaults are:

- Gender (if included in the anonymised data)
- SEN status (if present)
- Pupil Premium / FSM (if present)
- EAL (if present)
- Grade band (derived from scores: e.g. 9–8, 7–6, 5–4, 3–1 for GCSE, or A*–A, B–C, D–E, U for A-Level)
- Attendance band (if present: e.g. >95%, 90–95%, <90%)

An "Advanced: include more columns in risk check" toggle lets teachers add other columns to the analysis if they want a stricter check.

If any student has a unique combination of these quasi-identifiers — meaning they are the only person in the dataset with that particular set — they are potentially identifiable even without their name. The tool flags this in plain English:

> "⚠️ 3 students have a unique combination of attributes. For example: only 1 student has EHCP + Pupil Premium + Grade 9–8. Someone familiar with the class could identify them even without names."

The check uses a **scaled k threshold** based on cohort size: **k=5 for cohorts under 20 students, k=3 for cohorts of 20 or more.** In a class of 8, k=3 would mean 37.5% of the class shares a combination — but a teacher who knows all 8 students personally can likely narrow further through context. k=5 for small cohorts provides meaningfully stronger protection. For larger classes, k=3 is sufficient because the teacher's contextual knowledge is more diffuse.

**Implementation:** Group-by on the quasi-identifier columns only. For each row, count how many other rows share the same values. If count < k (where k is determined by cohort size), flag the row. Pure client-side computation, trivial in JS, runs in milliseconds even for large classes.

**What the teacher sees:** A summary like "24 of 30 students are in groups of 3+. 6 students have attribute combinations shared by fewer than 3 others." Each flagged group shows the specific combination that makes it unique (e.g. "Female + EHCP + Grade 9–8: 1 student"). The teacher can then decide to proceed, remove columns, generalise rare categories, or switch modes. The tool never blocks — it informs.

#### Rare-Category Generalisation

If a categorical column contains values that only one or two students have, those values are effectively identifying. If only one student has an EHCP, anyone who knows the class composition knows which row is that student, regardless of the fake name.

The tool scans each categorical column and detects values with fewer than 3 occurrences. It then offers to generalise them into broader categories using a built-in mapping:

| Original value | Generalised to |
|---------------|----------------|
| EHCP | SEN: Yes |
| School Action Plus | SEN: Yes |
| School Action | SEN: Yes |
| No SEN | SEN: No |
| Looked After Child (LAC) | Additional support: Yes |
| Child Protection Plan | Additional support: Yes |
| Previously LAC | Additional support: Yes |
| FSM | Disadvantaged: Yes |
| Pupil Premium | Disadvantaged: Yes |
| EAL | Additional support: Yes |
| Specific medical conditions | Medical: Yes |

The teacher sees: "Only 1 student has 'EHCP' in the SEN column. We recommend generalising to 'SEN: Yes' to prevent identification. [Apply / Keep original]"

Generalisation is always optional and always shown to the teacher before applying. The mapping table is extensible — teachers can add their own school-specific generalisations in the Pro tier.

**Why this matters:** This is something a teacher absolutely cannot do manually with Find & Replace. The tool is analysing the statistical properties of the dataset and making informed recommendations about what's safe to send. This is the feature that makes PupilSafe AI a genuine privacy tool rather than a fancy name-swapper.

> **Marketing angle:** "PupilSafe AI doesn't just change names. It analyses your dataset for re-identification risk and tells you which students could be identifiable — before any data leaves your browser."

### Layer 6: Attribute Separation (Post-MVP, Paid Tier)

*This feature is out of scope for MVP and included here for completeness only.*

For particularly sensitive data, the tool could split a spreadsheet into separate anonymised fragments, each with different fake names. Fragment 1 might contain fake names and scores; Fragment 2 contains different fake names and SEN status. The AI can analyse each dimension but cannot cross-reference them.

This is conceptually interesting but practically awkward — it requires the teacher to make multiple separate AI queries and somehow combine the results. The UX would be complex and the demand is unvalidated. If post-launch feedback suggests teachers need this level of protection, it can be designed properly at that point.

---

## Data Flow

At no point does student data leave the teacher's browser. The tool never sees it on a server. There is no server.

1. Teacher pastes or uploads class data into PupilSafe AI (runs in browser)
2. Teacher selects Accurate Mode or Anonymous Mode (sensitive-data modal nudge if high-sensitivity terms detected)
3. Anonymisation engine processes the data: names replaced, noise applied (if Anonymous), rows shuffled, free text scanned (runs in browser)
4. Risk analysis engine checks for re-identification risk: k-anonymity check on quasi-identifiers, rare-category detection, small-cohort warning (runs in browser)
5. **"What exactly will be sent" preview pane** — the teacher sees everything in one view before copying:
   - Anonymised dataset snippet (first 5–10 rows)
   - Detected sensitive columns shown as chips (e.g. `SEN` `PP` `Gender`)
   - Risk summary: k-anonymity results + rare-category flags
   - Any unresolved free-text flags
   - Microcopy: **"Real student names never leave your browser. Anonymisation happens locally before you paste anything into an AI tool. Review what will be sent below."**
   - **[Copy to clipboard]** button — only active after teacher has scrolled/reviewed
6. Anonymised data and generated prompt are copied to clipboard
7. Teacher manually pastes into ChatGPT / Claude / Gemini
8. Teacher manually copies the AI's response
9. Teacher pastes response back into PupilSafe AI
10. De-anonymisation engine swaps fake names back to real names (runs in browser)
11. Teacher gets the final, real-names output

The preview pane at step 5 is the **"I feel safe" moment** — the last thing the teacher sees before data leaves the tool. It consolidates everything: what the data looks like anonymised, what risks were detected, and the reassurance that nothing has left the browser yet. This is the trust-building screen.

---

## Prompt Template System

Each template guides the teacher through a short question flow, then generates a complete prompt with anonymised data embedded. Templates are stored as JSON objects with configurable fields.

### Free Tier Templates (3)

- **Analyse Class Performance** — Find trends, outliers, and groups needing intervention in assessment data.
- **Write Report Comments** — Generate personalised report comments based on student performance data.
- **Generate Differentiated Questions** — Create questions at different difficulty levels based on what the class is struggling with.

### Paid Tier Templates (10+)

- Identify Students for Intervention
- Compare Performance Across Assessments
- Suggest Collaborative Groupings
- Draft Parent Communication
- Create a Mark Scheme
- Generate Revision Materials Based on Weak Areas
- Write UCAS/Reference Material
- Analyse Behaviour Patterns
- Plan Seating Based on Data
- Generate IEP/Support Plan Suggestions

### Custom Templates (Paid Tier)

Teachers can create and save their own prompt templates with their preferred structure, tone, and output format.

---

## User Flow

### Step 1: Add Your Class

The teacher pastes a class list (names, one per line, or tab-separated with headers), uploads a CSV file, or types names manually. The tool detects columns — names, scores, categories, free text — and the teacher confirms each detection.

### Step 2: Choose Your Privacy Mode

Simple two-option toggle: Accurate Mode or Anonymous Mode, each with a one-sentence description. Default is Accurate Mode.

### Step 3: Choose Your Task

A visual grid of task cards. Each card has a one-sentence description. The teacher clicks one.

### Step 4: Answer Quick Questions

Two to four simple questions specific to that task. Dropdowns, toggles, short text. Takes 15–30 seconds.

### Step 5: Review & Copy

The tool displays the anonymised data (teacher can inspect what's being sent), any free-text flags for review, and the generated prompt (editable). A prominent review step asks the teacher to confirm the anonymised data looks safe, with a checkbox: "I have reviewed the anonymised data and confirmed it does not contain identifiable student information." Then a Copy All button puts everything on the clipboard.

### Step 6: Paste into AI

The teacher opens their preferred AI tool in another tab, pastes the prompt and data, and gets a response.

### Step 7: De-anonymise

The teacher returns to PupilSafe AI, pastes the AI's response into the Translate Back box. The tool swaps fake names back to real names and presents the final output. The teacher can copy or download as a document.

### Repeat Use

Previously used templates appear as Recent (session-based). The whole flow takes under two minutes once familiar.

---

## Monetisation

### Free Tier

- Unlimited anonymisation sessions
- 3 prompt templates (Analyse, Report Comments, Differentiated Questions)
- Both privacy modes available
- Free-text scanning included
- Session-based (data cleared when browser closes)

### Pro Tier — £2/month or £15/year

- All prompt templates (13+ and growing)
- Custom prompt templates
- PDF export of de-anonymised output
- Pro status restoration across devices (see Stripe integration below)

**Note on persistence:** Persistent class data (storing class lists across sessions) was originally planned for Pro launch but is deferred. Storing real student names in localStorage — even encrypted — is a risk that needs to be justified by real demand. The paid tier launches with templates + PDF export. Persistence is added later only if teachers actively request it and usage data confirms regular repeat use with the same class lists.

### Conversion Strategy

The free tier is unlimited in usage but session-based — data is cleared when the browser closes. There is no session limit. This is a deliberate choice: with no backend and no accounts, any client-side usage limit (e.g. "5 sessions per month") is trivially bypassed by clearing localStorage. Rather than building unenforceable restrictions or resorting to browser fingerprinting (which contradicts the privacy positioning), the free tier is genuinely unlimited.

The conversion lever is convenience, not restriction. Teachers who use the tool regularly will want the full template library (13+ templates covering every common task vs 3 in the free tier), custom template creation, and PDF export. These are features that genuinely add value for power users without degrading the free experience.

Both privacy modes are available on the free tier. Privacy is not a premium feature — that would be a terrible look.

The price point (£2/month) is low enough that a teacher pays personally without needing school approval or a purchase order. The annual option (£15/year) provides better value and reduces churn.

**Pricing UI:** Bias the UI toward annual. Show "£15/year (best value)" as the default-selected option, with monthly available but secondary. Stripe's fixed fee (20p per transaction) makes tiny monthly subscriptions expensive as a percentage — on a £2 monthly payment, Stripe takes ~12% vs ~4% on a £15 annual. The annual plan will do most of the revenue work.

### Launch Strategy

Launch as a completely free tool initially (no paid tier, no Stripe). This minimises liability exposure, builds the user base, and validates the product. Introduce the paid tier once there is clear usage data showing which teachers use it repeatedly.

---

## Technical Architecture

### Two-Part Build: Library + App

The anonymisation engine is built as a standalone JavaScript library (`@djb/shield`), separate from the PupilSafe AI web app. PupilSafe AI is a consumer of the library — but so are Dom's other tools (the marking tool, the maths revision site, and any future tool that touches student data and AI).

This is a deliberate architectural choice. The same anonymisation logic is needed wherever student data meets AI. Building it as a library from day one avoids the painful extraction later and forces clean separation between engine and UI.

#### `@djb/shield` — The Anonymisation Library

A pure JavaScript library with zero UI dependencies. Can be imported into any browser-based or Node.js project.

**What it does:**

| Capability | Method | Returns |
|-----------|--------|---------|
| Anonymise structured data | `shield.anonymise(data, config)` | Anonymised data (with fake names + ID tokens), name/ID mapping, risk analysis, free-text flags |
| De-anonymise AI response | `shield.deanonymise(text, mapping)` | De-anonymised text, unmatched name/ID warnings |
| Risk analysis (standalone) | `shield.analyseRisk(data, config)` | k-anonymity results, rare categories, plain-English recommendations |
| Free-text scanning (standalone) | `shield.scanText(text, config)` | Flagged items with types/positions, cleaned text |
| Column detection | `shield.detectColumns(data)` | Column type classifications with confidence scores |
| Noise application | `shield.addNoise(values, config)` | Noised values with grade-boundary awareness |

**API example:**

```javascript
import { Shield } from '@djb/shield';

const shield = new Shield({
  mode: 'accurate',       // or 'anonymous'
  seed: 42,               // deterministic PRNG seed (required for reproducible output)
  noise: { percent: 0.05, boundaries: [40, 50, 60, 70, 80] },
  gender: 'neutral',      // or provide explicit mapping
  kThreshold: 'auto',      // scales with cohort size: k=5 for <20 students, k=3 for ≥20
});

// Full anonymisation pipeline
const result = shield.anonymise(csvData, {
  columns: { 0: 'name', 1: 'score', 2: 'sen', 3: 'comments' }
});
// result.anonymised  — transformed data with fake names + [SXX] ID tokens
// result.mapping     — { ids: { 'S01': 'Real Name', ... }, names: { 'Fake Name': 'Real Name', ... } }
// result.risks       — { kAnonymity: [...], rareCategories: [...], recommendations: [...] }
// result.flags       — free-text scanner hits requiring review

// De-anonymise AI response (id-first strategy, default)
const output = shield.deanonymise(aiResponseText, result.mapping, {
  strategy: 'id-first'  // default: ID pass → structured name pass → global name pass
});
// output.text        — de-anonymised text with real names, IDs stripped
// output.unmatched   — any fake names/IDs the engine couldn't find/replace
// output.stats       — { idMatches: 24, nameMatches: 2, unmatched: 0 }

// De-anonymise JSON output from structured analysis templates
const jsonOutput = shield.deanonymise(aiJsonResponse, result.mapping, {
  strategy: 'json'  // parse as JSON, walk structure, replace IDs and names
});
// jsonOutput.parsed  — de-anonymised parsed JSON object
// jsonOutput.text    — null (use .parsed for JSON strategy)
// jsonOutput.valid   — true if JSON parsing succeeded

// Standalone risk analysis (no anonymisation)
const risks = shield.analyseRisk(data, {
  quasiIdentifiers: ['gender', 'sen', 'pp', 'gradeBand']
});

// Standalone free-text scanning
const scan = shield.scanText(commentText, {
  knownNames: ['Dominic Barker', 'Katherine Smith'],
  keywords: 'default'  // uses built-in medical/safeguarding/family lists
});
```

#### Deterministic PRNG (Critical for Cross-Language Parity)

All randomness in the library — name selection, row shuffling, noise draws — must come from a seeded, deterministic PRNG that produces identical output sequences in both JS and Python given the same seed.

**Algorithm: Mulberry32.** A simple 32-bit PRNG with excellent distribution properties and trivial to implement identically in both languages.

```javascript
// JS implementation
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
# Python implementation
def mulberry32(seed):
    def _next():
        nonlocal seed
        seed = (seed + 0x6D2B79F5) & 0xFFFFFFFF
        t = ((seed ^ (seed >> 15)) * (1 | seed)) & 0xFFFFFFFF
        t = (t + (((t ^ (t >> 7)) * (61 | t)) & 0xFFFFFFFF) ^ t) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return _next
```

**Usage:** The Shield constructor accepts a `seed` parameter. If no seed is provided, one is generated from the system clock (non-deterministic, fine for production). For testing and fixture generation, a fixed seed produces identical output across languages.

**Rules:**
- `Math.random()` (JS) and `random.random()` (Python) are **never called** inside the library. All randomness flows through the seeded PRNG.
- The PRNG instance is created once per Shield construction and used for all operations in sequence.
- Operations consume PRNG values in a defined order: name selection first, then noise, then shuffle. This ordering is part of the contract and must be identical in both implementations.

#### Numeric Alignment (Cross-Language Float Determinism)

JS and Python handle floating-point arithmetic identically (both IEEE 754 double), but rounding rules differ:

- JS `Math.round()` rounds 0.5 up (half-up)
- Python `round()` uses banker's rounding (half-to-even)

**Decision: round half away from zero, implemented manually in both languages.**

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

**All rounding in the library uses this function.** No calls to native `Math.round()` or `round()`. This eliminates the most common source of cross-language divergence in noise values.

**Laplace sampling** uses the algorithm already specified in the spec (sample from uniform, transform). Both implementations use the same formula:

```
u = prng() - 0.5  // uniform in (-0.5, 0.5)
laplace = mu - b * sign(u) * ln(1 - 2 * |u|)
```

After sampling: clamp to bounds, then `roundHalfAway()`. This sequence is deterministic given the same seed.

#### De-anonymisation: Structured-First Strategy

Since the prompt templates request structured output (table with Student column, or `STUDENT:` prefix lines), the de-anonymiser should exploit this structure before falling back to global replacement.

**`deanonymise(text, mapping, { strategy })` accepts four strategies:**

| Strategy | Behaviour |
|----------|-----------|
| `id-first` (default) | 1. Regex match all `[SXX]` ID tokens and replace with real names. 2. Detect tables/STUDENT: lines and replace remaining fake names. 3. Fall back to global boundary-aware replacement for any remaining fake names. |
| `json` | Parse input as JSON. Walk the structure and replace IDs and fake names in all string values. If parsing fails, fall back to `id-first` on the raw text. For structured analysis templates. |
| `structured-only` | ID replacement + structured name replacement only. Do not fall back to global. Safest option — any name not matched by ID, table cell, or STUDENT: line is flagged as unmatched. |
| `global` | Skip structure detection. Do boundary-aware replacement across the full text (ID pass first, then name pass). For use when AI output is unstructured prose. |

**Why `id-first` is the default:** ID tokens are unambiguous — `[S07]` can't be confused with a word in prose, can't be "corrected" by the AI, and can't partially match another token. This makes the ID pass virtually zero-error. The name passes exist as fallback for the rare case where a model drops an ID, but the expectation is that >95% of replacements happen in the ID pass.

**Package structure:**

```
@djb/shield/
├── src/
│   ├── index.js          # Main Shield class
│   ├── prng.js           # Mulberry32 seeded PRNG
│   ├── anonymiser.js     # Name replacement, shuffling
│   ├── noise.js          # Bounded Laplace noise, grade-boundary awareness
│   ├── scanner.js        # Free-text scanning (names, keywords, regex)
│   ├── risk.js           # k-anonymity, rare-category detection
│   ├── deanonymiser.js   # Structured-first + global replacement, NFKC, canonical-case
│   ├── columns.js        # Column type detection heuristics
│   ├── rounding.js       # roundHalfAway + numeric utilities
│   └── data/
│       ├── names.json        # Name bank (~15KB)
│       ├── keywords.json     # Medical/safeguarding/family term lists
│       └── generalisations.json  # Rare-category mapping table
├── tests/
│   └── (reads from shared test-fixtures/)
├── package.json
└── README.md
```

**Key design constraints:**

- Zero external dependencies (except Papa Parse for CSV parsing, optional)
- Runs in browser and Node.js
- All processing synchronous and in-memory (no async, no storage, no network)
- Stateless: every call is self-contained, mapping passed in/out explicitly
- All randomness from seeded Mulberry32 PRNG
- All rounding via `roundHalfAway` (never native `Math.round`/`round`)
- Data files (names, keywords, generalisations) bundled as JSON, loaded once
- ~20KB total bundle size target

#### `shield-py` — Python Version

An identical core API in Python, for server-side integration with Dom's Pi-hosted tools (maths revision site, marking tool, backtester, and any FastAPI/Flask service). Plus two extra server-side modes that the web app doesn't need.

**Why both languages:** The JS version runs in the browser for PupilSafe AI and any client-side tool. The Python version runs on the Pi for the maths revision site (FastAPI), the marking tool, and any future backend that handles student data before sending it to AI APIs. Same logic, same name bank, same PRNG, same rounding, same test fixtures — two implementations.

**API example (Python):**

```python
from shield import Shield

s = Shield(
    mode="accurate",
    seed=42,               # Same Mulberry32 PRNG as JS — identical output given same seed
    noise={"percent": 0.05, "boundaries": [40, 50, 60, 70, 80]},
    gender="neutral",
    k_threshold="auto",       # scales with cohort size: k=5 for <20 students, k=3 for ≥20
)

# Full anonymisation pipeline
result = s.anonymise(data, columns={0: "name", 1: "score", 2: "sen", 3: "comments"})
# result.anonymised, result.mapping (ids + names), result.risks, result.flags

# De-anonymise AI response (id-first, same as JS)
output = s.deanonymise(ai_response_text, result.mapping, strategy="id-first")
# output.text, output.unmatched, output.stats

# De-anonymise JSON output from structured analysis templates
json_output = s.deanonymise(ai_json_response, result.mapping, strategy="json")
# json_output.parsed, json_output.valid

# Standalone risk analysis
risks = s.analyse_risk(data, quasi_identifiers=["gender", "sen", "pp", "grade_band"])

# Standalone free-text scanning
scan = s.scan_text(comment, known_names=["Dominic Barker", "Katherine Smith"])
```

**Server-side-only modes (Python only):**

These exist in `shield-py` but are not exposed in the PupilSafe AI web app. They're for backend pipelines where no human reviews the output.

```python
# 1. One-way anonymisation (no mapping returned)
# For pipelines where you never need to de-anonymise.
# Safer default: the mapping doesn't exist, so it can't leak.
result = s.anonymise(data, columns=cols, one_way=True)
# result.mapping is None — cannot be reversed
# result.anonymised is still fully usable for analysis

# 2. Aggressive identifier stripping
# Server pipelines often ingest messier exports with columns the teacher UI
# would never see (UPN, DOB, full address, NHS number).
# This mode auto-detects and removes known identifier columns without asking.
result = s.anonymise(data, columns="auto", strip_identifiers=True)
# Columns matching known identifier patterns (UPN, DOB, postcode, email,
# phone, NHS number, student ID) are silently dropped before anonymisation.
# No confirmation step — this is for automated pipelines, not interactive use.
```

**When to use each mode:**

| Mode | Use case |
|------|----------|
| Standard (mapping returned) | PupilSafe AI, any tool where the teacher reviews and de-anonymises |
| `one_way=True` | Batch analytics pipelines, logging anonymised data for research, any case where de-anonymisation is never needed and the mapping is a liability |
| `strip_identifiers=True` | Ingesting raw school MIS exports (SIMS, Bromcom, Arbor) where columns like UPN, DOB, postcode may be present. The pipeline strips them automatically before any AI processing. |

**Package structure:**

```
shield-py/
├── shield/
│   ├── __init__.py        # Main Shield class
│   ├── prng.py            # Mulberry32 seeded PRNG (identical to JS)
│   ├── anonymiser.py      # Name replacement, shuffling
│   ├── noise.py           # Bounded Laplace noise, grade-boundary awareness
│   ├── scanner.py         # Free-text scanning (names, keywords, regex)
│   ├── risk.py            # k-anonymity, rare-category detection
│   ├── deanonymiser.py    # Structured-first + global replacement, NFKC, canonical-case
│   ├── columns.py         # Column type detection heuristics
│   ├── rounding.py        # round_half_away + numeric utilities
│   ├── identifiers.py     # Known identifier patterns (UPN, DOB, etc.) for strip mode
│   └── data/              # Symlinked or copied from shared data/
│       ├── names.json
│       ├── keywords.json
│       └── generalisations.json
├── tests/
│   └── (reads from shared test-fixtures/)
├── pyproject.toml
└── README.md
```

**Design constraints (Python-specific):**

- Zero heavy dependencies (no pandas, no numpy, no spaCy) — stdlib only: `re`, `unicodedata`, `json`, `math`
- **No `import random`** — all randomness from the Mulberry32 PRNG in `prng.py`, identical to JS
- All rounding via `round_half_away()` — never native `round()`
- Installable via `pip install shield-py` (or just copy the folder into a project)
- Runs on the Pi without any compiled dependencies
- Same data files (names, keywords, generalisations) shared between JS and Python versions

**Keeping the two versions in sync:**

The risk with two implementations is drift. Mitigations:

1. **Seeded PRNG with shared fixtures.** Given seed=42 and the same input CSV, both JS and Python must produce byte-identical anonymised output. The `test-fixtures/` directory contains input CSVs, seeds, and expected outputs. Both test suites validate against these. If a test passes in one language and fails in the other, something has drifted.

2. **Shared data files.** One `names.json`, one `keywords.json`, one `generalisations.json` — referenced by both packages. No separate copies.

3. **Explicit numeric contract.** Mulberry32 for PRNG, `roundHalfAway` for rounding, Laplace sampling formula defined in the spec. No native random or rounding functions. This eliminates the three most common sources of cross-language divergence.

4. **Spec-driven implementation.** The design document defines behaviour; both implementations follow it. The test fixtures are the contract.

5. **Minimal surface area.** The library is small (~500–600 lines per language for MVP). One person (Dom) writes both, and the shared fixtures catch mistakes.

#### Integration Map

| Tool | Language | How it uses `shield` |
|------|----------|---------------------|
| **PupilSafe AI web app** | JS (Svelte) | Full pipeline: anonymise → prompt → de-anonymise. All UI. |
| **Maths revision site** | Python (FastAPI) | Anonymise student performance data before AI API calls for personalised feedback. |
| **Marking tool** | Python | Anonymise class data before AI-assisted marking analysis. |
| **Any future FastAPI/Flask tool** | Python | Import and call. Same API. |
| **Any future browser tool** | JS | Import and call. Same API. |
| **HausKlar** | Python (FastAPI) | If any personal data needs anonymising before AI processing (e.g. medicine reminders, routine notes). |

**This is also the open-source candidate.** If the anonymisation engine is ever open-sourced for DPO trust, it's both packages — the JS and Python versions — published together with the shared test fixtures. DPOs can inspect the code in whichever language they're comfortable reading.

#### PupilSafe AI — The Web App

A Svelte app that imports `@djb/shield` and wraps it in the teacher-facing UI. This is the consumer product.

**What PupilSafe AI adds on top of the library:**

- Column confirmation UI with dropdowns and confidence indicators
- Mode selection UX with sensitive-data modal nudge
- Gender selection UI (report writing bulk-edit)
- Free-text flag review UI with "What to look for" checklist
- Risk analysis summary display (k-anonymity, rare categories, plain English)
- "What exactly will be sent" preview pane
- Prompt template system (question flows, prompt generation)
- Copy-to-clipboard with formula injection protection
- De-anonymisation paste-back UI
- Landing page, privacy page, analytics policy, school one-pager
- Stripe integration for Pro tier

**What PupilSafe AI does NOT contain:** any anonymisation logic. It calls `shield.anonymise()`, `shield.deanonymise()`, `shield.analyseRisk()`, and `shield.scanText()`. The library does the work; the app does the UX.

#### Integration with Dom's Other Tools

**Marking tool (InkScape):** Import `@djb/shield` directly. Before sending any class performance data to AI for analysis or feedback generation, call `shield.anonymise()`. After receiving the AI response, call `shield.deanonymise()`. The marking tool doesn't need the PupilSafe AI UI — it has its own interface. It just needs the engine.

**Maths revision site:** If personalised AI feedback based on student quiz performance is added, the library handles anonymisation before any API call. The 1500-question database stays on the Pi; only anonymised performance summaries go to AI.

**Future tools:** Any tool that handles student data and wants to use AI follows the same pattern: import the library, anonymise, send, receive, de-anonymise. The library is the shared infrastructure; each tool provides its own UI and workflow.

**HausKlar / non-education tools:** The library's scanner and anonymiser work on any PII, not just student data. If any personal data needs anonymising before AI processing, the same library applies.

### Tech Stack

| Component | Technology | Cost |
|-----------|-----------|------|
| Anonymisation library (browser) | `@djb/shield` (pure JS, npm) | Free |
| Anonymisation library (server) | `shield-py` (pure Python, pip) | Free |
| PupilSafe AI frontend | Svelte (compiled to static JS) | Free |
| Hosting | Netlify or Vercel (static) | Free |
| Payments | Stripe Checkout + 1 serverless function | 2.9% + 20p per txn |
| Analytics | Plausible or Fathom | ~£7/month |
| Domain | pupilsafe.co.uk + pupilsafe.com | ~£15/year |
| CSV parsing | Papa Parse (client-side) | Free (MIT) |
| PDF export | jsPDF (client-side) | Free (MIT) |

**Total running costs: approximately £10/month.** Everything else is free.

**Why Svelte:** The product has significant interactive UI — column confirmation dropdowns, free-text flag review with inline accept/reject, pronoun bulk-edit, risk analysis summary with expandable warnings, mode toggles, k-anonymity result display. Building this in vanilla JS would be painful and error-prone. Svelte compiles to lightweight static JS (no runtime framework), deploys identically to a static site, and gives reactivity exactly where it's needed. It's the lightest option that isn't masochistic.

### No Backend Required (Almost)

All anonymisation runs in the browser. All mappings stored in sessionStorage (or localStorage for paid tier persistence). No user accounts needed for free tier.

#### Stripe Integration for Pro Tier

The paid tier uses Stripe Checkout. The challenge: with no backend and no user accounts, how does the teacher retain Pro status across browser clears or device switches?

**Solution: One Netlify/Vercel serverless function.**

1. **Purchase flow:** Teacher clicks "Go Pro" → Stripe Checkout (hosted by Stripe) → on success, redirect back to PupilSafe AI with the Stripe customer ID and a short-lived token.
2. **Local storage:** The app stores the Stripe customer ID and email in localStorage. Pro features are unlocked immediately.
3. **Restore flow:** If a teacher clears their browser or switches devices, they see a "Restore Pro" link. They enter the email they used to pay. The serverless function sends a one-time 6-digit code to that email address. The teacher enters the code to confirm email ownership. The function then checks Stripe for an active subscription on that email and unlocks Pro if found. This proves email ownership without requiring a full auth system, preventing anyone who happens to know a paying teacher's email from unlocking Pro on their own browser.
4. **Subscription management:** A "Manage Subscription" link opens Stripe's hosted Customer Portal, where the teacher can cancel, update payment, or download invoices. Zero custom UI needed.

This approach requires exactly one serverless function (the email-to-subscription check). No database, no auth system, no session management. Total additional cost: zero (within Netlify/Vercel free tier limits).

**Email privacy commitment (stated on privacy page and in Terms):**

- Email addresses are used **only** for Pro restore verification and Stripe customer portal access
- No marketing emails, no newsletters, no "tips and tricks" sequences
- No email addresses are stored by PupilSafe AI — the serverless function is stateless (receives email, queries Stripe, sends code, forgets)
- The only place the email exists is in Stripe's systems, subject to Stripe's privacy policy
- The serverless function logs are configured to exclude request payloads (no email addresses in logs)

**School email filter fallback:** Many school email systems aggressively filter one-time codes (especially from unfamiliar domains). If the restore code fails to arrive:

- Primary: "Didn't receive the code? Check your spam folder."
- Fallback 1: "Still nothing? Click here to receive a Stripe Customer Portal link instead." This sends a Stripe-hosted email (from Stripe's domain, more likely to pass school filters) containing a link to manage the subscription. The teacher can verify their subscription status and re-enter their Stripe customer ID manually.
- Fallback 2: "Paid with a different email? Enter your Stripe invoice number instead." Teachers can find their invoice number on the Stripe receipt email (accessible on their phone even if they're on a school device that can't reach personal email). The serverless function validates the invoice number against Stripe and unlocks Pro. This covers the common case where a teacher paid with a personal email but is restoring on a school computer where they can't access that inbox.
- This avoids the need for a custom "contact support" flow and keeps everything stateless.

---

## Go-To-Market

### Sample Dataset (Try It Immediately)

The landing page includes a downloadable sample dataset (CSV) that teachers can paste into the tool to see the full pipeline in action before using their own data. This is a critical trust-building asset — teachers who can see the anonymisation, risk analysis, and de-anonymisation working on realistic data will trust the tool with their own.

**Sample dataset design:**

- 22 fictitious students (large enough to show k-anonymity working, small enough to scan visually)
- Realistic UK secondary school structure: first name + surname, gender, SEN status (including 1 EHCP, 2 K-code), PP/FSM flags, EAL, percentage scores, attendance, teacher comments
- Deliberately includes privacy "traps" that the tool should catch:
  - A comment mentioning a student's sibling by name ("James's sister Emily also struggled with this topic")
  - A comment referencing a specific medical condition ("Has been absent due to hospital appointments for epilepsy treatment")
  - A comment naming a location ("Missed the assessment due to the residential trip to Snowdonia")
  - A comment with a teacher name ("As discussed with Mrs Patel in the review meeting")
  - One student with a unique combination (EHCP + PP + Grade 9) that k-anonymity should flag
  - One student with attendance below 80% (quasi-identifier at extremes)
- The dataset is bundled with the app and also available as a standalone download
- The landing page demo video uses this exact dataset, so teachers see the same data in the video and in their own browser

This sample dataset is also used as a test fixture during development — it's the "golden path" test case that both JS and Python libraries validate against.

**Sample dataset as regression test (critical):** The sample dataset is not just a demo asset — it is a formal automated test. The test assertion is: given the sample dataset, the scanner must flag ALL planted privacy traps with zero misses. This test runs in both JS and Python test suites as a blocking test — if anyone changes the scanner logic and the sample dataset test fails, that's a build failure. The sample dataset is frozen once created; it never changes, and only gains new traps if new scanner capabilities are added. Every planted trap (sibling name, medical condition, location, teacher name, k-anonymity-flagged student, low-attendance outlier) has a corresponding assertion in the test. If the demo can't catch its own traps, it destroys trust immediately.

### Launch Channels

- Teaching communities (Twitter/X teacher community, colleagues)
- TES Resources — list as a free tool with link to the site
- Teacher Facebook groups (UK Secondary Teachers, Maths Teachers UK)
- Reddit — r/TeachingUK
- Blog post: "How to use ChatGPT with student data without breaking GDPR" (SEO play)

### Marketing Approach

"Made by a teacher" is the strongest marketing asset. Launch content should feel like a teacher talking to other teachers. A short Loom video demonstrating the full round-trip — paste data, anonymise, get AI output, de-anonymise — will do more than any landing page copy.

### SEO Keywords

- use ChatGPT with student data GDPR
- anonymise student data for AI
- teacher AI privacy tool
- ChatGPT GDPR schools UK
- safe AI for teachers
- AI for teachers UK
- GDPR compliant AI schools

### Content Marketing

- Short blog posts: "5 ways to use AI for report writing without risking student data"
- Template showcases: "This week's new template: parent evening prep"
- GDPR explainers for teachers (builds trust and authority)

---

## Liability and Legal Considerations

### Architectural Defence

PupilSafe AI is designed so that real student names and identifiable data never leave the teacher's browser. The anonymised data that teachers copy into AI tools contains only fake names and (optionally) noised scores — but it does leave the browser via the clipboard. The distinction matters: "identifiable student data never leaves your browser" is the accurate claim, not "student data never leaves your browser." There are no servers that receive, process, or store student data. There is no database. The anonymisation engine runs entirely in client-side JavaScript. This is a verifiable architectural fact, not a legal interpretation.

We deliberately avoid claiming "PupilSafe AI is not a data processor" — that analysis depends on regulatory context, delivery method, and telemetry, and is best left to legal counsel. What we can say with certainty is: we have designed the system so that we never receive student data.

### Verifiability Affordances

Teachers and DPOs should be able to verify the "no network" claim themselves. Trust built on verifiability is stronger than trust built on copy.

**1. "Verify it yourself" button in the app.**
A small link in the footer or on the privacy page: "Want to verify? Here's how." Clicking it shows a simple 3-step guide:
- Open your browser's Developer Tools (F12 or right-click → Inspect)
- Click the Network tab
- Run an anonymisation. You'll see zero network requests.

This costs nothing to build and is the single most convincing thing for a technically curious DPO. It turns "we say we don't send data" into "you can see we don't send data."

**2. "Works Offline" badge.**
Once the app has loaded, it functions entirely offline. After the initial page load, display a small badge: "✓ Works offline — no internet needed for anonymisation." This is a visceral trust cue: if it works without internet, it clearly isn't sending data anywhere. The badge only appears after confirming the service worker is active / the app has loaded all assets.

**3. Architecture diagram on the privacy page.**
A single static diagram showing the data flow:

```
┌─────────────┐    clipboard     ┌──────────────┐    clipboard     ┌─────────────┐
│  Your Data   │───────────────→│ PupilSafe AI  │───────────────→│  AI Tool     │
│ (real names) │                │  (browser)    │  (fake names)  │ (ChatGPT etc)│
└─────────────┘                │               │                └──────┬───────┘
                                │  anonymise ↕  │                       │
                                │  de-anonymise │←──────────────────────┘
                                └───────────────┘    clipboard
                                                    (fake names)

  ✗ No server    ✗ No database    ✗ No network calls    ✓ Everything in your browser
```

Visual beats paragraphs. A DPO can look at this diagram for 5 seconds and understand the architecture. It belongs on the privacy page and in the school one-pager PDF.

### Analytics Policy

Analytics are treated as hostile by default. The following rules are non-negotiable:

- No user-entered content ever appears in URLs, query parameters, event payloads, error logs, or crash reports
- Analytics are limited to: page views, coarse events (template selected, mode chosen, session completed), and nothing else
- No session replay, no heatmaps, no form analytics
- The privacy/analytics page on the site explicitly states what is tracked and what is not
- If any analytics provider cannot guarantee the above, it is not used

One leaked snippet in a query string would destroy the entire trust proposition. This is the single most important operational discipline.

### Key Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Anonymisation misses something and a student is identifiable | Review step with teacher confirmation checkbox. Free-text scanner framed as helper, not guarantee. Terms of service make teacher the responsible party as data controller. |
| Marketing language implies GDPR compliance guarantee | Use "helps protect", "designed to anonymise", "reduces the risk of". Never use "guarantees". Never claim "GDPR-compliant." |
| Statistical noise claim is technically inaccurate | Do not claim formal "differential privacy." Use "statistical noise" and "bounded random shifting." Accurate and defensible without overpromising. |
| Analytics leak user data | Analytics treated as hostile by default. No payloads, no URLs, no error logging of inputs. Explicit analytics policy on site. |
| AI providers add built-in anonymisation | Prompt generation and teacher-specific UX remain valuable even if basic anonymisation becomes commoditised. |
| Schools provide enterprise AI with GDPR compliance | Slow to procure and deploy. Individual teacher tool fills the gap. Many schools will never buy enterprise AI. |
| Teachers don't trust a free tool with student data | Emphasise: real names never leave browser. "Verify it yourself" DevTools guide. "Works Offline" badge. Architecture diagram. Open-source the anonymisation engine (see below). Clear privacy architecture on the site. |
| Low conversion to paid tier | Free tier is unlimited but session-based. Conversion is on convenience features for regular users. |

### Open-Sourcing the Anonymisation Engine

Consider open-sourcing both `@djb/shield` (JS) and `shield-py` (Python) — not the full PupilSafe AI product, just the engine in both languages, with the shared test fixtures. This is a trust accelerant: security-minded teachers or DPOs can inspect exactly what the code does in whichever language they can read. It doesn't harm monetisation because the paid value is in the PupilSafe AI UI (templates, preview pane, prompt generation, PDF export), not the anonymiser itself. A public GitHub repo also serves as a credibility signal and potentially attracts contributions from other developer-teachers.

### Legal Review

A proper legal review of terms of service and marketing claims is recommended before introducing the paid tier. Options for obtaining this affordably include: school DPO review (framed as "I've built something, can you sanity-check my approach"), teacher union legal helplines (included with NEU/NASUWT membership), or a one-off data protection solicitor review (budget £300–500). While the tool is free and clearly labelled as a helper, liability exposure is minimal.

### School Policy One-Pager

A downloadable one-page PDF should be available from the site, covering: what PupilSafe AI does, what it does not do (no servers, no storage, no data transmission), and a teacher responsibility checklist. Teachers will forward this to line managers and DPOs. This is both a trust-building tool and a practical enabler — many teachers need something to show their head of department before they'll use a new tool with student data.

### Standardised Language

All marketing, UI copy, and documentation should use consistent wording. The following phrases are approved; alternatives should be avoided:

**Use these (verifiable, defensible):**
- "Designed to help you anonymise student data before using AI tools."
- "Reduces the risk of sharing identifiable data."
- "You remain responsible for reviewing what you send."
- "Anonymisation happens locally in your browser before you paste anything into an AI tool."
- "Real student names never leave your browser."

**Never use these (compliance implications):**
- ~~"Student data never leaves your browser"~~ — misleading; the anonymised data does leave via clipboard when pasted into AI. The accurate claim is about identifiable data / real names.
- ~~"GDPR-compliant"~~ — implies a compliance guarantee we cannot make
- ~~"We don't process data"~~ — legally messy; Stripe restore handles email addresses
- ~~"Guaranteed anonymisation"~~ — no guarantee is possible
- ~~"Fully anonymised"~~ — implies completeness we cannot certify
- ~~"Safe to use"~~ — unqualified safety claims

The one absolute claim — "real student names never leave your browser" — is only made where it is architecturally true (i.e. the anonymisation engine, which runs client-side and outputs to the clipboard, never to a network). The anonymised data itself does leave the browser when the teacher pastes it into an AI tool — but it contains no identifiable information. This distinction must be maintained in all marketing and privacy copy. The claim does not apply to the Stripe restore function, which handles email addresses via a serverless function.

### Terms of Service — Key Points

- The tool assists with anonymisation but the teacher remains the data controller
- The teacher is responsible for reviewing anonymised output before sending it anywhere
- PupilSafe AI provides a privacy aid, not a compliance certification
- No guarantee that all identifying information will be detected
- No data is collected, stored, or transmitted by PupilSafe AI
- Analytics are limited to page views and coarse usage events (documented on site)

---

## Competitive Landscape

| Tool | Target | Gap |
|------|--------|-----|
| Anonymator.ai | Enterprise / developers | Too technical for teachers. Requires API keys. |
| anonym.legal | Lawyers | Wrong audience. Enterprise pricing. |
| GPT Privacy | General users | Manual setup. No prompt help. No educational focus. |
| Privacy Protector | ChatGPT users | Simple find/replace only. No data analysis. No free-text scanning. |
| Microsoft Presidio | Developers | Requires coding. Not a product. |
| Manual Find & Replace | Teachers | No free-text scanning. No noise option. No prompt generation. No grade-boundary awareness. |
| School AI platforms (Century Tech, Sparx, Kognity) | Schools (institutional purchase) | Solve specific problems (adaptive learning, homework) but don't give teachers general-purpose AI access with their own data. Require school procurement. |
| School-provided Copilot / enterprise AI | Schools with budget | Excellent where available, but most UK schools haven't purchased and won't for years. PupilSafe AI fills the gap. |

### Our Differentiation

1. **Built specifically for teachers** — the UX speaks their language, not developer language
2. **Re-identification risk analysis** — k-anonymity checking and rare-category detection analyse the dataset and warn teachers before data leaves the browser. No competitor in the education space does this.
3. **Two clear privacy modes** — teachers choose the right trade-off for their context
4. **Free-text scanning** — catches identifying information in comments and notes that name-swapping alone misses
5. **Grade-boundary-aware noise** — in Anonymous Mode, scores are shifted without crossing key grade thresholds
6. **Rare-category generalisation** — automatically detects and offers to broaden categories that could identify individual students
7. **Prompt generation included** — solves the "I don't know what to ask" problem
8. **End-to-end flow** — anonymise → prompt → de-anonymise in one tool
9. **Zero technical setup** — no API keys, no extensions, no accounts needed
10. **Made by a teacher** — understands the workflow, the constraints, and the culture
11. **100% client-side** — can truthfully say "real student names never leave your browser"

---

## MVP Scope

### In MVP (v1.0)

#### `@djb/shield` (JS library)

- [ ] Seeded Mulberry32 PRNG (all randomness flows through it, never Math.random)
- [ ] `roundHalfAway` rounding utility (never native Math.round)
- [ ] Name anonymisation with rotating random names and collision detection (including free-text content)
- [ ] Gendered and gender-neutral fake name assignment
- [ ] Bounded statistical noise on numerical columns (Anonymous Mode)
- [ ] Grade-boundary awareness: bands as [lower inclusive, upper exclusive) intervals
- [ ] Integer rounding of noised values (deliberate: reduces fingerprintability)
- [ ] Narrow-band safety guard: if band has only 1 possible integer, return original + flag in `perturbationFailures` (noised values allowed to equal original — genuine Laplace behaviour)
- [ ] Row shuffling
- [ ] Column type detection with confidence scores + always-sensitive identifier list (UPN, DOB, admission no, postcode, email, phone, NHS number)
- [ ] UK MIS column recognition list (Form, House, Set, KS2, FFT, CAT, etc.)
- [ ] Free-text scanning: class-list name matching, keyword lists, regex patterns
- [ ] k-Anonymity checking with scaled threshold (k=5 for cohorts <20, k=3 for cohorts ≥20) on defined quasi-identifier set (gender, SEN, PP, EAL, grade band, attendance band)
- [ ] Rare-category detection and generalisation with built-in mapping table
- [ ] Student ID token generation ([S01], [S02], etc.) included in anonymised output
- [ ] De-anonymisation: id-first strategy (ID regex pass → structured name pass → global name fallback)
- [ ] De-anonymisation: `json` strategy for structured analysis templates (parse, walk, replace)
- [ ] De-anonymisation: `structured-only` and `global` strategy options
- [ ] De-anonymisation stats: idMatches, nameMatches, unmatched counts returned to UI
- [ ] Case-insensitive match with canonical-case replacement + Unicode NFKC normalisation
- [ ] Boundary-aware regex (punctuation, curly quotes, possessives, all-caps)
- [ ] Longest-name-first replacement order
- [ ] Shared test fixtures (input CSVs + seeds + expected outputs, validated in both languages)
- [ ] Sample dataset (22 fictitious students with deliberate privacy traps for scanner validation)
- [ ] Sample dataset regression test: automated blocking test asserting all planted traps are caught with zero misses (both JS and Python)

#### `shield-py` (Python library)

- [ ] Port of all JS library functionality to Python
- [ ] Identical Mulberry32 PRNG (same seed → same output as JS)
- [ ] Identical `round_half_away` (never native `round()`)
- [ ] Identical API surface (Shield class, anonymise, deanonymise, analyse_risk, scan_text)
- [ ] Same name bank, keyword lists, and generalisation mappings (shared JSON files)
- [ ] Validated against shared test fixtures (byte-identical results to JS version given same seed)
- [ ] Zero heavy dependencies (stdlib only: re, unicodedata, json, math — no `import random`)
- [ ] Runs on Raspberry Pi without compiled dependencies
- [ ] Server-only mode: `one_way=True` (no mapping returned, irreversible anonymisation)
- [ ] Server-only mode: `strip_identifiers=True` (auto-remove UPN/DOB/postcode/email/phone/NHS columns)

#### PupilSafe AI web app (Svelte)

- [ ] Landing page with clear value proposition and embedded demo video
- [ ] Downloadable sample dataset on landing page (22 students with privacy traps)
- [ ] Sample "Assessment → Intervention groups" demo on landing page using the sample dataset
- [ ] Class list input (paste or CSV upload)
- [ ] Column detection UI with confidence indicators and teacher confirmation/override
- [ ] Always-sensitive columns highlighted red with lock icon + modal (Remove recommended / Redact / Keep)
- [ ] Two-mode privacy selector (Accurate / Anonymous)
- [ ] Sensitive-data modal nudge (triggers on EHCP/LAC/safeguarding/behaviour columns: Switch to Anonymous / Remove columns / Continue)
- [ ] Small cohort detection banner (n < 15, nudge toward Anonymous Mode)
- [ ] Tiered gender risk model (Low/Medium/High based on cohort size + sensitive categories)
- [ ] Report writing template: pronoun selection UI with bulk-edit
- [ ] Analysis templates: gender column off by default, toggleable
- [ ] "Use they/them for everyone" one-click toggle (always available)
- [ ] Free-text flagging UI with teacher review, confirmation, and "What to look for" checklist
- [ ] Risk analysis summary UI (flagged students with specific combinations shown in plain English)
- [ ] Perturbation failure warnings (if narrow-band guard triggered)
- [ ] "What exactly will be sent" preview pane (anonymised snippet, sensitive column chips, risk summary, microcopy)
- [ ] 3 prompt templates with question flows
- [ ] Prompt generation with all five instructions (student IDs, full names with explicit prohibitions, structured output, no invented names, exact-match tokens)
- [ ] JSON schema output for structured analysis templates (Analyse, Intervention, Comparison, Groupings)
- [ ] JSON validation with auto-repair prompt on parse failure
- [ ] Fallback to text-based de-anonymisation if JSON repair also fails
- [ ] Copy-to-clipboard functionality with formula injection protection
- [ ] Review step with teacher confirmation checkbox
- [ ] Safety net: highlight any unmatched partial name matches for teacher review
- [ ] Split-view workflow: Prompt pane (left) + "Paste AI response here" pane (right) + one-click "Open ChatGPT" / "Open Claude" / "Open Gemini" button. Reduces tab-switching friction without requiring an extension. The teacher stays in PupilSafe AI for the entire round-trip.
- [ ] Mobile-responsive design
- [ ] "How it works" explainer page
- [ ] Privacy architecture page (builds trust, includes threat model, architecture diagram, "Verify it yourself" DevTools guide, "Works Offline" badge, email privacy commitment)
- [ ] Downloadable school policy one-pager (PDF) including architecture diagram
- [ ] Analytics policy page (what we track and don't track)

### After MVP (v1.1+)

**Priority based on early feedback:**

- [ ] Browser extension (intercepts paste into ChatGPT/Claude/Gemini, auto-fills response back) — the copy/paste round-trip is the biggest retention risk. The split-view workflow reduces friction, but the extension eliminates it. If usage data shows teachers start anonymisation but don't complete the de-anonymisation step, the extension becomes urgent. This should be treated as Plan A for retention, not a nice-to-have. Build it as soon as MVP usage data confirms the drop-off point.

**Paid tier features:**

- [ ] Stripe payment integration (feature-gated Pro tier)
- [ ] Serverless function for Pro status restoration via email verification
- [ ] Additional prompt templates
- [ ] Custom template builder
- [ ] PDF export of de-anonymised output

**Persistence (validate demand first):**

- [ ] Persistent class storage (Pro tier) — deferred from launch. The encryption-at-rest approach (AES-GCM + passphrase) is "best effort" and if a teacher's browser is compromised, it won't save them. Launch the paid tier with templates + PDF export first. Add persistence only if teachers actively request it and the risk/benefit trade-off is justified by real usage patterns.
- [ ] "Clear all local data" button (ships with persistence if/when built)

**Engine improvements:**
- [ ] Excel file upload (SheetJS)
- [ ] PDF export of de-anonymised output
- [ ] Attribute separation mode (if demand validated)
- [ ] Improved free-text scanner (capitalised-word flagging, UK place-name list, school-specific terms, learning from corrections)
- [ ] Quasi-identifier combination analysis (cross-column re-identification risk beyond simple k-anonymity)
- [ ] Teacher-extensible generalisation mappings (Pro tier)
- [ ] Open-source `@djb/shield` + `shield-py` with shared test fixtures (trust accelerant)
- [ ] CSV export with formula injection protection

### Not Building (Out of Scope)

- User accounts / authentication (use Stripe for "pro" gating)
- Backend / database / API
- Direct AI integration (the tool doesn't call AI APIs — the teacher does manually)
- Mobile app (PWA is sufficient)
- School-wide admin features (this is for individual teachers)

---

## Success Metrics

| Metric | Target (3 months) | Target (6 months) |
|--------|-------------------|-------------------|
| Monthly active users | 200 | 500 |
| Paying users | — (free launch) | 50 |
| Monthly revenue | — | £100 |
| Anonymisation sessions/month | 500 | 2,000 |
| Mode split (Accurate vs Anonymous) | Tracked | Tracked |
| Template usage distribution | Tracked | Tracked |
| Free-text flags per session (avg) | Tracked | Tracked |
| Pro conversion rate | — | Tracked |

---

## Development Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. `@djb/shield` (JS) | 1.5 weeks | Core library: anonymiser, noise engine, scanner, risk analysis, de-anonymiser, column detection. Test suite with shared fixtures. |
| 2. `shield-py` (Python) | 3–4 days | Port of JS library to Python. Same API, same name bank, same keyword lists. Validated against shared test fixtures. |
| 3. Prompt system | 1 week | 3 templates with question flows, prompt generation with structured output instructions |
| 4. PupilSafe AI UI (Svelte) | 1.5 weeks | Complete user flow: column confirmation, mode selection with sensitive-data modal, risk summary, preview pane, gender selection, free-text review with "What to look for" checklist, responsive design, landing page with embedded demo video, privacy explainer |
| 5. Testing | 3–4 days | End-to-end testing with real class data structures, edge cases, grade-boundary behaviour, de-anonymisation with various AI output formats, k-anonymity edge cases |
| 6. Polish & launch | 3–4 days | Visual polish, deploy, record Loom demo (the most important marketing asset), share in communities |
| **Total** | **~6.5 weeks** | **Library (JS + Python) + PupilSafe AI MVP live and shareable** |

The extra week compared to a monolithic build covers the Python port and the shared test fixtures. This is worth it: the library is immediately usable in the marking tool and maths revision site, and the clean separation makes both the library and the app easier to maintain and test.

**Build order matters:** JS library first (because PupilSafe AI is the first consumer and validates the API design), then Python port (because the shared test fixtures already exist and the Python implementation is a straight translation), then Svelte UI (because the library API is now stable).

---

## Implementation Notes

These are technical details that will save pain during build. They don't affect the product design but are important to get right.

### De-anonymisation: Use Word-Boundary Matching

Even with the full-name prompt instruction, naive global string replacement (`str.replace(fakeName, realName)`) can misfire if a fake name appears inside another word, in a heading, or as part of commentary. Use boundary-aware regex: `new RegExp('\\b' + escapeRegex(fakeName) + '\\b', 'gi')`. Also replace longest names first to avoid partial overlaps (e.g. "James Chen" should be replaced before "James").

### Free-Text Scanner: Consistent Redaction Transforms

When the scanner flags an item and the teacher confirms redaction, the replacement should be consistent and predictable:

| Detected type | Replacement |
|--------------|-------------|
| Student name | The assigned fake name for that student |
| Family relationship + name | [PARENT/GUARDIAN] |
| Medical/SEN term | [ADDITIONAL NEEDS] |
| Safeguarding term | [SENSITIVE - REMOVED] |
| Location/school name | [LOCATION] |
| Date | [DATE] |
| Postcode/phone/email | [REDACTED] |

This consistency helps teachers trust what they're seeing. Every flagged item has a clear, predictable replacement rather than an ad-hoc rewrite.

### Column Detection: Handle Mixed-Type Columns

Real school exports are messy. A "Score" column might contain: 73, 85, Absent, M, N/A, late entry. The column detector should treat numeric columns as numeric-with-exceptions. Non-numeric values in an otherwise numeric column should be routed to the review UI with a note ("these cells don't look like numbers — how should we handle them?"), not trigger a hard failure or reclassification.

### CSV/Export Safety: Guard Against Formula Injection

If the tool ever exports to CSV or copies data that a teacher will paste into Excel/Sheets, cells starting with `=`, `+`, `-`, or `@` can be interpreted as formulas. This is a known injection vector. Mitigation: prefix any such cells with `'` on export or copy-to-clipboard.

### Don't Ship Until: Critical Gotchas

These are things that will bite later if not addressed before launch:

1. **Clipboard + analytics + error logs.** Even if you never send content intentionally, frameworks and plugins can capture exceptions that include data fragments. If you ever add Sentry or any error logging, be extremely careful. The analytics-as-hostile discipline must extend to every dependency.

2. **CSV injection is a copy-to-clipboard issue too.** Teachers will paste tabular output directly into Excel. The formula injection protection (prefixing `=`, `+`, `-`, `@` cells) must be part of the core copy pipeline for any tabular output, not just explicit CSV export.

3. **Name collision policy must be comprehensive.** The blocked-tokens set (defined in the Name Anonymisation section above) is the solution. It goes beyond fake-matches-real to cover teacher names, sibling names, location-surnames, and any token flagged in free-text scanning. This must be implemented before launch — not deferred — because a single collision in a demo or early user session would destroy trust. The "helper not guarantee" framing is crucial, but the blocked-tokens policy should catch the vast majority of cases.

4. **Stripe restore email is still sensitive.** The email verification function sends one-time codes. Ensure the email provider logs don't store request payloads. Keep the function's inputs minimal: email address only, nothing else.

5. **ID token preservation across AI providers.** The `[SXX]` ID tokens must be tested against all three AI providers (ChatGPT, Claude, Gemini) before launch. Verify that models preserve the bracketed tokens in their output. If any provider strips or reformats the tokens, adjust the token format (e.g. `«S07»` or `{S07}` instead of `[S07]`). Also test Instruction 5 ("copy names exactly as provided") — if any provider consistently "corrects" names despite the instruction, the ID-first approach means this is a cosmetic issue rather than a functional failure, but the name-matching fallback should still include a fuzzy-match layer that catches common mutations (case changes, hyphen removal, spacing changes) and flags them for teacher review.

---

## Appendix A: Noise Implementation (JavaScript)

### Design Decisions

**Integer rounding:** In Anonymous Mode, all noised values are rounded to whole numbers. This is a deliberate choice, not a shortcut. Decimal scores (e.g. 67.3%) can be fingerprinting vectors — a teacher who knows "only Jameel got 67.3" can identify the row even after name replacement. Rounding to integers collapses many students into the same possible values, increasing the anonymity set. The spec states this explicitly:

> *"In Anonymous Mode, all numerical values are rounded to whole numbers for simplicity and to reduce fingerprintability."*

**Band definitions:** Grade boundaries are defined as inclusive-lower, exclusive-upper intervals: `[lower, upper)`. The teacher provides boundaries as a sorted array of threshold values (e.g. `[40, 50, 60, 70, 80]`). The library constructs bands from these:

| Band | Lower (inclusive) | Upper (exclusive) | Integer range after rounding |
|------|-------------------|-------------------|------------------------------|
| Below 40 | 0 | 40 | 0–39 |
| 40–49 | 40 | 50 | 40–49 |
| 50–59 | 50 | 60 | 50–59 |
| 60–69 | 60 | 70 | 60–69 |
| 70–79 | 70 | 80 | 70–79 |
| 80+ | 80 | max | 80–max |

This means a score of exactly 40 is in the 40–49 band, not the below-40 band. A score of 39.7 on a test out of 60, after being treated as the raw mark (not converted to %), stays in whichever band contains 39.7. After noise and rounding, it lands on an integer within that band.

**Non-percentage scales:** Teachers use marks out of 24, 30, 60, etc. The library does not convert to percentages — it works on raw values. The `range` parameter tells the library the maximum possible mark. Boundaries are provided in the same scale as the marks. If a teacher's test is out of 24 with grade boundaries at [8, 12, 16, 20], those are the boundaries — no percentage conversion needed.

**Narrow-band safety guard:** When a band contains very few possible integer values after rounding (e.g. a band of [78, 80) has only two values: 78 and 79), the noise draw may produce degenerate results. The guard:

1. If the band has only 1 possible integer value (e.g. [79, 80) — only 79 is possible), **return the original and flag it.** The result object includes a `perturbationFailures` array listing any values that could not be meaningfully perturbed.
2. Otherwise, the Laplace draw proceeds normally — clamped to the band and rounded. If the result happens to equal the original, that's fine. This is the natural behaviour of a genuine statistical distribution; forcing it to differ would constitute an information leak (an adversary who knows the tool never returns the original can rule out one candidate value).

The flag lets the PupilSafe AI UI (or any consumer) warn the teacher: "1 value could not be perturbed without crossing a grade boundary. Consider widening bands or removing this column."

```javascript
// NOTE: prng is a Mulberry32 instance, passed in from the Shield constructor.
// Never use Math.random(). All randomness flows through the seeded PRNG.

function roundHalfAway(x) {
  return Math.sign(x) * Math.floor(Math.abs(x) + 0.5);
}

function laplace(mu, b, prng) {
  const u = prng() - 0.5;
  return mu - b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

function getBand(value, boundaries, maxValue) {
  // Bands are [lower, upper) intervals.
  // boundaries must be sorted ascending.
  // Returns { lower (inclusive), upper (exclusive), intMin, intMax }
  const sorted = [...boundaries].sort((a, c) => a - c);
  let lower = 0;
  let upper = maxValue + 1; // exclusive upper for top band
  for (const b of sorted) {
    if (value >= b) lower = b;
    else { upper = b; break; }
  }
  // Integer range within this band (after rounding)
  const intMin = Math.ceil(lower);        // first integer >= lower
  const intMax = Math.ceil(upper) - 1;    // last integer < upper
  return { lower, upper, intMin, intMax };
}

function addBoundedNoise(value, maxValue, noisePercent, gradeBoundaries, prng) {
  // Returns { value: number, failed: boolean }
  // failed=true means couldn't perturb without breaking constraints
  const maxNoise = maxValue * noisePercent;
  const b = maxNoise / 2; // Laplace scale parameter

  let noise = laplace(0, b, prng);
  noise = Math.max(-maxNoise, Math.min(maxNoise, noise));

  if (gradeBoundaries && gradeBoundaries.length > 0) {
    const band = getBand(value, gradeBoundaries, maxValue);
    const bandWidth = band.intMax - band.intMin + 1;

    // Safety guard: band has only 1 possible integer value
    if (bandWidth <= 1) {
      return { value: band.intMin, failed: true };
    }

    const noised = roundHalfAway(value + noise);
    let clamped = Math.max(band.intMin, Math.min(band.intMax, noised));

    // Allow result to equal original — this is the natural behaviour of a
    // genuine Laplace draw. Forcing it to differ would be an information leak.
    return { value: clamped, failed: false };
  }

  // No boundaries: apply noise with range clamping
  const noised = roundHalfAway(value + noise);
  let clamped = Math.max(0, Math.min(maxValue, noised));
  return { value: clamped, failed: false };
}

// Example usage:
// const prng = mulberry32(42);
// const boundaries = [8, 12, 16, 20]; // test out of 24
// const result = addBoundedNoise(11, 24, 0.05, boundaries, prng);
// result.value will be in [8, 11] (the 8–11 band), result.failed = false
// Deterministic given the same seed — identical result in Python
```

## Appendix B: Name Bank Requirements

- ~250 male first names, ~250 female first names, ~50 gender-neutral first names, ~500 surnames
- Culturally diverse (reflecting UK school demographics)
- No names that are offensive, ambiguous, or extremely rare
- Names should be plausible in a UK school context
- Stored as a static JSON file bundled with the app (~15KB), tagged by gender category
- **No names that are also common English words** (e.g. "Grace", "Rose", "Mark" are fine as first names but "Park", "Hill", "Field" should be avoided as surnames to reduce false matches in free-text)
- The blocked-tokens policy (see Name Anonymisation section) ensures no generated name collides with any real student name, staff name, sibling name, or any other token flagged in the current session's free-text scanning. The name bank provides the pool; the blocked-tokens set filters it per-session.

## Appendix C: Column Detection and Confirmation

The tool needs to automatically detect what kind of data each column contains:

1. **Names**: Contains mostly alphabetic strings, 2+ words per cell, matches common name patterns. Must also detect surname-first formats ("Barker, Dominic") and code-style identifiers ("DBa", "D.B.", "BARKER D") which are common in UK school exports.
2. **Numerical scores**: Contains mostly numbers, optionally with % signs
3. **Categorical**: Contains a small set of repeated values (e.g. SEN codes, grade bands, gender)
4. **Free text**: Contains longer strings with varied content (e.g. teacher comments)
5. **Dates**: Contains date-formatted strings

**Default to caution with asymmetric confidence thresholds:** The confidence threshold for flagging a column for review varies based on the risk of misclassification, not a single magic number. The key insight is that misclassifying a name column as something else (allowing names to pass through unredacted) is catastrophic, while misclassifying a numeric column as categorical is merely inconvenient (the teacher corrects it in review).

**Asymmetric thresholds by misclassification risk:**

| If the column might be... | Confidence threshold for auto-classification | Rationale |
|--------------------------|---------------------------------------------|-----------|
| Names (could be misclassified as free-text or categorical) | ≥90% confidence required, otherwise forced into review | Misclassifying names is the worst failure mode — force review aggressively |
| Free-text (could contain names) | ≥85% confidence required | Free-text may hide names in narrative; err toward review |
| Numerical scores | ≥75% confidence required | A column with 20 entries where 15 are numbers and 5 are "Abs", "N/A", "M" is clearly numeric-with-exceptions — safe to auto-classify with a note |
| Categorical | ≥75% confidence required | Low-risk misclassification; teacher can easily correct |
| Dates | ≥80% confidence required | Moderate risk (dates can be identifying) |

**How confidence is calculated:** Confidence is the percentage of non-empty cells matching the detected pattern. A column with 24 numeric values and 1 "Absent" is 96% numeric — auto-classified with the non-numeric values routed to the review UI. A column with 16 numbers and 4 text values out of 20 is 80% — still auto-classified as numeric at the 75% threshold, but the 4 exceptions are surfaced. A column with 12 two-word alphabetic strings and 3 single-word entries out of 15 is 80% name-like — below the 90% threshold for name auto-classification, so it's forced into review. This asymmetry means the review queue gets more false positives for potential name columns (mildly annoying) but virtually never misses a real name column (catastrophe avoided).

When any column falls below its threshold, it is flagged as "potential identifier" and forced into the review queue rather than auto-classified. This is critical because misclassifying a name column as free text (or vice versa) could allow names to pass through unredacted.

### Always-Sensitive Identifiers (Auto-Detect and Modal)

Certain column types are so identifying that they should trigger the sensitive-data modal regardless of which mode the teacher has selected — even in Accurate Mode. These are columns that uniquely identify a student on their own and have no analytical value in an AI prompt.

**Always-sensitive column patterns (header matching, case-insensitive):**

| Pattern | Matches | Why |
|---------|---------|-----|
| `UPN`, `unique pupil` | Unique Pupil Number | Nationally unique identifier |
| `admission`, `adm no`, `admission number` | School admission number | Unique within school |
| `DOB`, `date of birth`, `birth date`, `d.o.b` | Date of birth | Highly identifying, especially combined with gender |
| `candidate`, `candidate no`, `candidate number`, `UCI` | Exam candidate number | Exam board identifier |
| `ULN`, `unique learner` | Unique Learner Number | Post-16 national identifier |
| `postcode`, `post code`, `zip` | Home postcode | Locates to ~15 households |
| `email`, `e-mail` | Student or parent email | Directly identifying |
| `phone`, `tel`, `mobile`, `contact number` | Phone number | Directly identifying |
| `NHS`, `NHS number` | NHS number | Nationally unique |
| `address`, `home address`, `street` | Home address | Directly identifying |

**When any of these are detected, the modal offers:**

1. **Remove these columns (recommended)** — primary button, default action
2. **Keep but redact values** — replace with "[REMOVED]"
3. **Keep as-is** — requires explicit "I understand" confirmation

The key UX principle: the default action is removal because these columns never add analytical value to an AI prompt. A teacher asking "which students need intervention based on their maths scores?" doesn't need UPN or DOB in the dataset. Making removal the primary button means teachers who click through quickly do the safe thing.

### Common UK School Export Columns (Recognition List)

Beyond always-sensitive identifiers, UK MIS exports (SIMS, Bromcom, Arbor, iSAMS) include columns that the detection engine should recognise and classify correctly on first sight:

| Column header patterns | Classification | Notes |
|----------------------|----------------|-------|
| `Form`, `Reg`, `Reg group`, `Tutor group` | Categorical (quasi-identifier) | Small groups — included in k-anonymity check |
| `House` | Categorical (quasi-identifier) | 4–8 values typically |
| `Teacher`, `Class teacher`, `Subject teacher` | Name (not student) | Flag for review — teacher names in data |
| `Set`, `Set code`, `Teaching group` | Categorical (quasi-identifier) | Often implies ability level |
| `KS2 fine level`, `KS2 scaled score` | Numerical score | Historical attainment — analytically useful |
| `FFT20`, `FFT50`, `FFT5`, `ALPS` | Numerical score | Target/benchmark data |
| `CAT score`, `CAT verbal`, `CAT non-verbal` | Numerical score | Cognitive ability data |
| `PP`, `Pupil Premium`, `FSM`, `Ever 6` | Categorical (quasi-identifier) | Disadvantage flag — included in k-anonymity |
| `SEN`, `SEN stage`, `EHCP`, `K code` | Categorical (quasi-identifier, sensitive) | May trigger sensitive-data modal |
| `EAL`, `EAL stage` | Categorical (quasi-identifier) | |
| `LAC`, `Looked after`, `CLA` | Categorical (sensitive) | Always triggers sensitive-data modal |
| `Attendance %`, `PA`, `Sessions absent` | Numerical score | Quasi-identifier at extremes |

This recognition list is stored in the library's `columns.js`/`columns.py` and used by the auto-detection engine. It doesn't hard-code behaviour — it improves confidence scores so the teacher sees accurate classifications in the confirmation UI.

**Confirmation UI:** After detection, the teacher sees a preview of the first 5 rows with each column labelled by its detected type. Each column header has a dropdown allowing the teacher to override the detection. The UI clearly highlights any uncertain column with an amber indicator and the label "Please check." Any always-sensitive column is highlighted in red with a lock icon. The teacher must confirm the column types before proceeding.

This step is critical and cannot be skipped. If the tool miscategorises a name column as free text, anonymisation could fail silently.

## Appendix D: Free-Text Scanner — Keyword Categories

| Category | Example Terms |
|----------|--------------|
| Family relationships | mother, father, mum, dad, parent, guardian, brother, sister, sibling, carer, step-parent |
| Medical / SEN | ADHD, autism, ASD, dyslexia, dyspraxia, EHC plan, SEMH, diagnosed, medication, anxiety, depression, OCD, epilepsy, hearing impairment, visual impairment |
| Safeguarding | social services, CAMHS, looked-after, LAC, child protection, safeguarding, disclosure, allegation |
| Specific identifiers | Dates (dd/mm/yyyy patterns), postcodes (UK format), phone numbers, email addresses |
| Institutional | School names (proper nouns followed by "School", "Academy", "College"), trip destinations, specific event names |

The scanner also checks for any name from the class list appearing in any free-text field, including partial matches (surname only, first name only). See the Free-Text Scanning section in the main spec for full implementation details and MVP scope.
