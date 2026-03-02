/**
 * @module scanner
 * Free-text scanning for names, keywords, and sensitive patterns.
 * Pure functions, zero dependencies, ES module.
 */

import keywordsData from './data/keywords.json' with { type: 'json' };

/**
 * Extract ~30 characters of context around a match.
 * @param {string} text - Full text
 * @param {number} start - Match start index
 * @param {number} end - Match end index
 * @returns {string} Context snippet
 */
function extractContext(text, start, end) {
  const pad = 15;
  const ctxStart = Math.max(0, start - pad);
  const ctxEnd = Math.min(text.length, end + pad);
  let ctx = '';
  if (ctxStart > 0) ctx += '...';
  ctx += text.slice(ctxStart, ctxEnd);
  if (ctxEnd < text.length) ctx += '...';
  return ctx;
}

/**
 * Build a word-boundary-aware, case-insensitive regex for a phrase.
 * Uses Unicode-aware word boundaries where possible.
 * @param {string} phrase - The phrase to match
 * @returns {RegExp}
 */
function buildWordBoundaryRegex(phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Use \b for word boundaries — works for ASCII names/keywords
  return new RegExp(`\\b${escaped}\\b`, 'gi');
}

/**
 * Scan text for known names from a class list.
 * Checks full names, first names, and surnames individually.
 * @param {string} text
 * @param {string[]} knownNames - Array of full names, e.g. ["James Chen", "Emily Barker"]
 * @param {string[]} staffNames - Optional array of staff names
 * @returns {Array<{type: string, value: string, position: number, context: string}>}
 */
function scanNames(text, knownNames, staffNames) {
  const flags = [];
  const allNames = [...(knownNames || []), ...(staffNames || [])];

  // Collect all name parts to search for: full names, first names, surnames
  // Search longest first to avoid substring issues
  const nameParts = [];

  for (const fullName of allNames) {
    const parts = fullName.trim().split(/\s+/);
    // Add the full name
    nameParts.push({ pattern: fullName.trim(), original: fullName.trim() });
    // Add individual parts (first name, surname, middle names)
    for (const part of parts) {
      if (part.length >= 2) { // Skip single-char initials
        nameParts.push({ pattern: part, original: part });
      }
    }
  }

  // Deduplicate by lowercase pattern
  const seen = new Set();
  const uniqueParts = [];
  for (const np of nameParts) {
    const key = np.pattern.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueParts.push(np);
    }
  }

  // Sort longest first so full names are matched before parts
  uniqueParts.sort((a, b) => b.pattern.length - a.pattern.length);

  // Track matched positions to avoid duplicates
  const matchedPositions = new Set();

  for (const { pattern } of uniqueParts) {
    const regex = buildWordBoundaryRegex(pattern);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const pos = match.index;
      const matchEnd = pos + match[0].length;

      // Check if this position range overlaps with any existing flag
      let isDuplicate = false;
      for (const existingPos of matchedPositions) {
        const [eStart, eEnd] = existingPos.split(':').map(Number);
        // Overlap check: this match is contained within an existing one
        if (pos >= eStart && matchEnd <= eEnd) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        matchedPositions.add(`${pos}:${matchEnd}`);
        flags.push({
          type: 'name',
          value: match[0],
          position: pos,
          context: extractContext(text, pos, matchEnd),
        });
      }
    }
  }

  return flags;
}

/**
 * Scan text for keywords from the keyword lists.
 * @param {string} text
 * @param {object} keywords - Object with { medical, safeguarding, family } arrays
 * @returns {Array<{type: string, subtype: string, value: string, position: number, context: string}>}
 */
function scanKeywords(text, keywords) {
  const flags = [];
  const categories = ['medical', 'safeguarding', 'family'];

  for (const category of categories) {
    const terms = keywords[category];
    if (!terms || !Array.isArray(terms)) continue;

    // Sort longest first to match multi-word phrases before single words
    const sorted = [...terms].sort((a, b) => b.length - a.length);

    for (const term of sorted) {
      const regex = buildWordBoundaryRegex(term);
      let match;
      while ((match = regex.exec(text)) !== null) {
        const pos = match.index;
        const matchEnd = pos + match[0].length;
        flags.push({
          type: 'keyword',
          subtype: category,
          value: match[0],
          position: pos,
          context: extractContext(text, pos, matchEnd),
        });
      }
    }
  }

  return flags;
}

/**
 * Scan text for date patterns (UK formats).
 * @param {string} text
 * @returns {Array<{type: string, value: string, position: number, context: string}>}
 */
function scanDates(text) {
  const flags = [];
  // Match dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy and shorter variants like d/m/yy
  const dateRegex = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g;
  let match;
  while ((match = dateRegex.exec(text)) !== null) {
    const pos = match.index;
    const matchEnd = pos + match[0].length;
    flags.push({
      type: 'date',
      value: match[0],
      position: pos,
      context: extractContext(text, pos, matchEnd),
    });
  }
  return flags;
}

/**
 * Scan text for UK postcodes.
 * @param {string} text
 * @returns {Array<{type: string, value: string, position: number, context: string}>}
 */
function scanPostcodes(text) {
  const flags = [];
  // UK postcode pattern: A9 9AA, A99 9AA, A9A 9AA, AA9 9AA, AA99 9AA, AA9A 9AA
  const postcodeRegex = /\b([A-Za-z]{1,2}\d[A-Za-z\d]?)\s*(\d[A-Za-z]{2})\b/g;
  let match;
  while ((match = postcodeRegex.exec(text)) !== null) {
    const pos = match.index;
    const matchEnd = pos + match[0].length;
    flags.push({
      type: 'postcode',
      value: match[0],
      position: pos,
      context: extractContext(text, pos, matchEnd),
    });
  }
  return flags;
}

/**
 * Scan text for UK phone numbers.
 * @param {string} text
 * @returns {Array<{type: string, value: string, position: number, context: string}>}
 */
function scanPhones(text) {
  const flags = [];
  // UK mobile: 07xxxxxxxxx, landline: 01xxxxxxxxx or 02xxxxxxxxx, international: +44
  const phoneRegex = /(?:\+44\s?\d[\d\s]{8,12}|(?:\b0[1-27]\d{2,3}\s?\d{3,4}\s?\d{3,4}\b)|\b07\d{3}\s?\d{3}\s?\d{3}\b|\b07\d{9}\b|\b01\d{8,9}\b|\b02\d{9}\b)/g;
  let match;
  while ((match = phoneRegex.exec(text)) !== null) {
    const pos = match.index;
    const matchEnd = pos + match[0].length;
    flags.push({
      type: 'phone',
      value: match[0],
      position: pos,
      context: extractContext(text, pos, matchEnd),
    });
  }
  return flags;
}

/**
 * Scan text for email addresses.
 * @param {string} text
 * @returns {Array<{type: string, value: string, position: number, context: string}>}
 */
function scanEmails(text) {
  const flags = [];
  const emailRegex = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
  let match;
  while ((match = emailRegex.exec(text)) !== null) {
    const pos = match.index;
    const matchEnd = pos + match[0].length;
    flags.push({
      type: 'email',
      value: match[0],
      position: pos,
      context: extractContext(text, pos, matchEnd),
    });
  }
  return flags;
}

/**
 * Scan text for extra user-supplied regex patterns.
 * @param {string} text
 * @param {Array<{pattern: RegExp|string, type: string}>} extraPatterns
 * @returns {Array<{type: string, value: string, position: number, context: string}>}
 */
function scanExtraPatterns(text, extraPatterns) {
  const flags = [];
  if (!extraPatterns || !Array.isArray(extraPatterns)) return flags;

  for (const { pattern, type } of extraPatterns) {
    const regex = pattern instanceof RegExp
      ? new RegExp(pattern.source, 'g' + (pattern.flags.includes('i') ? 'i' : ''))
      : new RegExp(pattern, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      const pos = match.index;
      const matchEnd = pos + match[0].length;
      flags.push({
        type: type || 'custom',
        value: match[0],
        position: pos,
        context: extractContext(text, pos, matchEnd),
      });
    }
  }
  return flags;
}

/**
 * Remove duplicate flags at the same position with the same type.
 * When a position is covered by both a longer and shorter match of the same type,
 * keep only the longer match.
 * @param {Array} flags
 * @returns {Array}
 */
function deduplicateFlags(flags) {
  // Sort by position, then by value length descending (prefer longer matches)
  const sorted = [...flags].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return b.value.length - a.value.length;
  });

  const result = [];
  const seenPositionType = new Set();

  for (const flag of sorted) {
    const key = `${flag.position}:${flag.type}:${flag.subtype || ''}`;
    if (!seenPositionType.has(key)) {
      seenPositionType.add(key);
      result.push(flag);
    }
  }

  return result;
}

/**
 * Scan free text for sensitive information.
 *
 * @param {string} text - The text to scan
 * @param {object} config - Configuration object
 * @param {string[]} config.knownNames - Array of full names from class list
 * @param {string[]} [config.staffNames] - Optional array of staff names
 * @param {string|object} [config.keywords='default'] - 'default' to use built-in keywords, or custom { medical, safeguarding, family }
 * @param {Array<{pattern: RegExp|string, type: string}>} [config.extraPatterns] - Optional additional regex patterns
 * @returns {{ flags: Array<{type: string, value: string, position: number, context: string}>, cleaned: string }}
 */
export function scanText(text, config = {}) {
  if (typeof text !== 'string' || text.length === 0) {
    return { flags: [], cleaned: text || '' };
  }

  const {
    knownNames = [],
    staffNames = [],
    keywords = 'default',
    extraPatterns = [],
  } = config;

  // Resolve keywords
  const resolvedKeywords = keywords === 'default' ? keywordsData : keywords;

  // Run all scanners
  const allFlags = [
    ...scanNames(text, knownNames, staffNames),
    ...scanKeywords(text, resolvedKeywords),
    ...scanDates(text),
    ...scanPostcodes(text),
    ...scanPhones(text),
    ...scanEmails(text),
    ...scanExtraPatterns(text, extraPatterns),
  ];

  // Deduplicate and sort by position
  const deduplicated = deduplicateFlags(allFlags);
  deduplicated.sort((a, b) => a.position - b.position);

  // Build cleaned text with flagged items replaced by redaction placeholders
  const cleaned = buildCleanedText(text, deduplicated);

  return { flags: deduplicated, cleaned };
}

/**
 * Redaction label for each flag type.
 * @type {Object<string, string|function>}
 */
const REDACTION_LABELS = {
  name: '[REDACTED NAME]',
  keyword: (flag) => {
    if (flag.subtype === 'medical') return '[ADDITIONAL NEEDS]';
    if (flag.subtype === 'safeguarding') return '[REDACTED]';
    if (flag.subtype === 'family') return '[PARENT/GUARDIAN]';
    return '[REDACTED]';
  },
  date: '[REDACTED DATE]',
  postcode: '[REDACTED POSTCODE]',
  phone: '[REDACTED PHONE]',
  email: '[REDACTED EMAIL]',
  custom: '[REDACTED]',
};

/**
 * Build cleaned text with all flagged items replaced by redaction placeholders.
 * Processes flags from end to start to preserve positions.
 *
 * @param {string} text - Original text
 * @param {Array<{type: string, value: string, position: number}>} flags - Sorted flags
 * @returns {string} Cleaned text with redactions applied
 */
function buildCleanedText(text, flags) {
  if (flags.length === 0) return text;

  // Work backwards to preserve position indices
  let result = text;
  const sorted = [...flags].sort((a, b) => b.position - a.position);

  for (const flag of sorted) {
    const label = typeof REDACTION_LABELS[flag.type] === 'function'
      ? REDACTION_LABELS[flag.type](flag)
      : REDACTION_LABELS[flag.type] || '[REDACTED]';
    result = result.slice(0, flag.position) + label + result.slice(flag.position + flag.value.length);
  }

  return result;
}
