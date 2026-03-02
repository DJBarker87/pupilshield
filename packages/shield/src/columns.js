/**
 * @module columns
 * Column type detection heuristics for UK school data exports.
 * Pure functions, zero dependencies, ES module.
 */

/**
 * Headers that indicate an always-sensitive identifier column.
 * Matched case-insensitively against the full header string.
 * @type {Array<{pattern: RegExp, label: string}>}
 */
const SENSITIVE_PATTERNS = [
  { pattern: /\bupn\b/i, label: 'UPN' },
  { pattern: /\buln\b/i, label: 'ULN' },
  { pattern: /\bdob\b/i, label: 'DOB' },
  { pattern: /\bdate\s*of\s*birth\b/i, label: 'DOB' },
  { pattern: /\bpostcode\b/i, label: 'postcode' },
  { pattern: /\bemail\b/i, label: 'email' },
  { pattern: /\bphone\b/i, label: 'phone' },
  { pattern: /\bnhs\b/i, label: 'NHS' },
  { pattern: /\baddress\b/i, label: 'address' },
  { pattern: /\bcandidate\s*no\b/i, label: 'candidate number' },
  { pattern: /\badmission\s*no\b/i, label: 'admission number' },
];

/**
 * UK MIS column header patterns that boost categorical classification.
 * @type {RegExp[]}
 */
const MIS_CATEGORICAL_PATTERNS = [
  /\bform\b/i,
  /\bhouse\b/i,
  /\bset\b/i,
  /\bks2\b/i,
  /\bfft\b/i,
  /\bcat\b/i,
  /\bpp\b/i,
  /\bsen\b/i,
  /\beal\b/i,
  /\blac\b/i,
  /\battendance\b/i,
  /\bteacher\b/i,
  /\btutor\b/i,
  /\byear\b/i,
  /\bclass\b/i,
];

/**
 * Confidence thresholds per type. Below these, column is forced to review.
 */
const THRESHOLDS = {
  name: 0.90,
  'free-text': 0.85,
  date: 0.80,
  numerical: 0.75,
  categorical: 0.75,
};

/**
 * Non-numeric exception values that should not disqualify a column as numerical.
 */
const NUMERIC_EXCEPTIONS = new Set(['absent', 'n/a', 'x', '-', '']);

/**
 * Header keywords that boost specific type classifications.
 */
const HEADER_BOOSTS = {
  name: [/\bname\b/i, /\bstudent\b/i, /\bpupil\b/i],
  numerical: [/\bscore\b/i, /\bmark\b/i, /\bpercent\b/i, /\battendance\b/i, /\bgrade\b/i],
  'free-text': [/\bcomment\b/i, /\bnote\b/i, /\bremark\b/i],
  date: [/\bdate\b/i, /\bdob\b/i, /\bbirth\b/i],
};

/** Boost amount added to confidence when header matches. */
const HEADER_BOOST_AMOUNT = 0.10;

/**
 * Check whether a header matches any always-sensitive identifier pattern.
 *
 * @param {string} header
 * @returns {{ sensitive: boolean, label: string|null }}
 */
function checkSensitive(header) {
  for (const { pattern, label } of SENSITIVE_PATTERNS) {
    if (pattern.test(header)) {
      return { sensitive: true, label };
    }
  }
  return { sensitive: false, label: null };
}

/**
 * Check whether a header matches any UK MIS categorical pattern.
 *
 * @param {string} header
 * @returns {boolean}
 */
function isMisCategorical(header) {
  return MIS_CATEGORICAL_PATTERNS.some((p) => p.test(header));
}

/**
 * Check whether a header matches boosts for a given type.
 *
 * @param {string} header
 * @param {string} type
 * @returns {boolean}
 */
function hasHeaderBoost(header, type) {
  const patterns = HEADER_BOOSTS[type];
  if (!patterns) return false;
  return patterns.some((p) => p.test(header));
}

/**
 * Test whether a value looks like a name.
 * Requires 2-4 words, primarily alphabetic characters (plus hyphens, apostrophes, commas, periods, spaces).
 * Also handles surname-first format: "Barker, Dominic".
 * Rejects long strings (sentences/free-text) and code-like short formats.
 *
 * @param {string} val
 * @returns {boolean}
 */
function looksLikeName(val) {
  const trimmed = val.trim();
  if (trimmed.length < 3) return false;

  // Names are short — reject anything that looks like a sentence
  if (trimmed.length > 50) return false;

  // Strip commas for word counting (handles "Barker, Dominic")
  const normalised = trimmed.replace(/,/g, '');

  // Must have 2-4 words (names rarely have more than 4 parts)
  const words = normalised.trim().split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;

  // Each word should be primarily alphabetic (allow hyphens, apostrophes within)
  for (const word of words) {
    // Remove leading/trailing punctuation like periods
    const cleaned = word.replace(/^[.\-']+|[.\-']+$/g, '');
    if (cleaned.length < 1) return false;
    // Must be mostly alpha (allow internal hyphens and apostrophes)
    if (!/^[A-Za-z][A-Za-z'\-]*[A-Za-z]$/.test(cleaned) && !/^[A-Za-z]$/.test(cleaned)) {
      return false;
    }
  }

  // Reject code-like formats: all words too short (e.g. "D.B.", "DBa")
  const allShort = words.every((w) => w.replace(/[^A-Za-z]/g, '').length <= 2);
  if (allShort) return false;

  return true;
}

/**
 * Test whether a value looks like a number (or an acceptable exception).
 *
 * @param {string} val
 * @returns {{ isNumeric: boolean, isException: boolean }}
 */
function looksLikeNumber(val) {
  const trimmed = val.trim();
  if (trimmed === '') return { isNumeric: false, isException: true };

  if (NUMERIC_EXCEPTIONS.has(trimmed.toLowerCase())) {
    return { isNumeric: false, isException: true };
  }

  // Try parsing as number
  const num = Number(trimmed);
  if (!Number.isNaN(num) && trimmed !== '') {
    return { isNumeric: true, isException: false };
  }

  // Allow percentage strings like "85%"
  if (/^\d+(\.\d+)?%$/.test(trimmed)) {
    return { isNumeric: true, isException: false };
  }

  return { isNumeric: false, isException: false };
}

/**
 * Test whether a value matches a date pattern.
 *
 * @param {string} val
 * @returns {boolean}
 */
function looksLikeDate(val) {
  const trimmed = val.trim();
  // dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(trimmed)) return true;
  // yyyy-mm-dd
  if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(trimmed)) return true;
  // Named months: "15 Jan 2024", "January 15, 2024", "15-Jan-2024"
  if (/\b\d{1,2}[\s\-][A-Za-z]{3,9}[\s\-,]\s*\d{2,4}\b/.test(trimmed)) return true;
  if (/\b[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}\b/.test(trimmed)) return true;
  return false;
}

/**
 * Classify a single column by analysing header and cell values.
 *
 * @param {string} header - Column header
 * @param {string[]} values - All non-empty cell values for this column
 * @param {number} totalRows - Total number of data rows
 * @returns {{ type: string, confidence: number }}
 */
function classifyColumn(header, values, totalRows) {
  if (values.length === 0) {
    return { type: 'categorical', confidence: 0 };
  }

  const nonEmpty = values.filter((v) => v.trim() !== '');
  if (nonEmpty.length === 0) {
    return { type: 'categorical', confidence: 0 };
  }

  const count = nonEmpty.length;

  // --- Score each type ---

  // Name score
  let nameMatches = 0;
  for (const v of nonEmpty) {
    if (looksLikeName(v)) nameMatches++;
  }
  let nameConf = nameMatches / count;
  if (hasHeaderBoost(header, 'name')) {
    nameConf = Math.min(1, nameConf + HEADER_BOOST_AMOUNT);
  }

  // Date score
  let dateMatches = 0;
  for (const v of nonEmpty) {
    if (looksLikeDate(v)) dateMatches++;
  }
  let dateConf = dateMatches / count;
  if (hasHeaderBoost(header, 'date')) {
    dateConf = Math.min(1, dateConf + HEADER_BOOST_AMOUNT);
  }

  // Numerical score
  let numericMatches = 0;
  let numericExceptions = 0;
  for (const v of nonEmpty) {
    const { isNumeric, isException } = looksLikeNumber(v);
    if (isNumeric) numericMatches++;
    else if (isException) numericExceptions++;
  }
  // Confidence = (numeric + exceptions) / total, but only if there are actual numbers
  let numConf = numericMatches > 0 ? (numericMatches + numericExceptions) / count : 0;
  if (hasHeaderBoost(header, 'numerical')) {
    numConf = Math.min(1, numConf + HEADER_BOOST_AMOUNT);
  }

  // Categorical score
  const uniqueValues = new Set(nonEmpty.map((v) => v.trim().toLowerCase()));
  const uniqueRatio = uniqueValues.size / count;
  const avgLen = nonEmpty.reduce((sum, v) => sum + v.trim().length, 0) / count;

  let catConf = 0;
  if (uniqueRatio < 0.3 && avgLen < 20) {
    catConf = 1 - uniqueRatio; // Fewer unique values = higher confidence
  } else if (uniqueRatio < 0.5 && avgLen < 20) {
    catConf = 0.5;
  }
  if (isMisCategorical(header)) {
    catConf = Math.min(1, catConf + HEADER_BOOST_AMOUNT + 0.15); // Stronger boost for MIS headers
  }

  // Free-text score
  let ftConf = 0;
  if (avgLen > 30 && uniqueRatio > 0.7) {
    ftConf = Math.min(1, uniqueRatio * (avgLen > 50 ? 1 : 0.9));
  } else if (avgLen > 20 && uniqueRatio > 0.5) {
    ftConf = 0.5;
  }
  if (hasHeaderBoost(header, 'free-text')) {
    ftConf = Math.min(1, ftConf + HEADER_BOOST_AMOUNT);
  }

  // --- Priority-based selection: name > date > numerical > categorical > free-text ---
  const candidates = [
    { type: 'name', confidence: nameConf },
    { type: 'date', confidence: dateConf },
    { type: 'numerical', confidence: numConf },
    { type: 'categorical', confidence: catConf },
    { type: 'free-text', confidence: ftConf },
  ];

  // Filter to candidates that meet their threshold
  const passing = candidates.filter(
    (c) => c.confidence >= (THRESHOLDS[c.type] || 0.75)
  );

  if (passing.length > 0) {
    // Return the first passing candidate (priority order is already correct)
    return { type: passing[0].type, confidence: passing[0].confidence };
  }

  // Nothing passes threshold — pick the best confidence and flag for review
  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];
  // If everything is 0, default to categorical
  if (best.confidence === 0) {
    return { type: 'categorical', confidence: 0 };
  }
  return { type: best.type, confidence: best.confidence };
}

/**
 * Detect column types for a tabular dataset.
 *
 * @param {string[]} headers - Array of column header strings.
 * @param {Array<Array<string>>} rows - Array of row arrays (strings), no header row.
 * @returns {{ columns: Array<{index: number, name: string, type: string, confidence: number, sensitive: boolean, reviewRequired: boolean}> }}
 */
export function detectColumns(headers, rows) {
  if (!headers || headers.length === 0) {
    return { columns: [] };
  }

  const totalRows = rows ? rows.length : 0;
  const columns = [];

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i] || '';
    const values = rows ? rows.map((row) => String(row[i] ?? '')) : [];

    // Check always-sensitive identifiers first
    const { sensitive } = checkSensitive(header);

    // Classify the column content
    const { type: detectedType, confidence } = classifyColumn(header, values, totalRows);

    // If the column is a sensitive identifier, override type
    const type = sensitive ? 'identifier' : detectedType;

    // Determine review requirement based on asymmetric thresholds
    const threshold = THRESHOLDS[type] || 0.75;
    const reviewRequired = !sensitive && confidence < threshold;

    columns.push({
      index: i,
      name: header,
      type,
      confidence: Math.floor(confidence * 100 + 0.5) / 100,
      sensitive,
      reviewRequired,
    });
  }

  return { columns };
}
