/**
 * @module deanonymiser
 * De-anonymisation engine for @djb/shield.
 *
 * Strategies:
 *  - id-first (default): ID regex → structured name → global name fallback
 *  - json: Parse JSON, walk structure, replace IDs + names
 *  - structured-only: ID + structured only, no global fallback
 *  - global: ID pass + global boundary-aware name replacement
 *
 * All text is NFKC-normalised before matching.
 */

/**
 * Normalise a string to Unicode NFKC form.
 * @param {string} s
 * @returns {string}
 */
function nfkc(s) {
  return s.normalize('NFKC');
}

/**
 * Build a boundary-aware regex for a name string.
 * Handles punctuation, possessives (ASCII and curly), and word boundaries.
 * @param {string} name
 * @param {string} [flags='gi']
 * @returns {RegExp}
 */
function nameBoundaryRegex(name, flags = 'gi') {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match the name at word boundaries, optionally followed by possessive 's or \u2019s
  // The lookbehind/lookahead ensure we don't match inside longer words.
  return new RegExp(
    `(?<![\\w])${escaped}(?![\\w])`,
    flags
  );
}

/**
 * Escape a string for use in a regex.
 * @param {string} s
 * @returns {string}
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace all fake names in a string using boundary-aware, case-insensitive matching.
 * Longest names are replaced first to prevent partial matches.
 * Canonical-case replacement is always used (the real name in its stored casing).
 *
 * @param {string} text
 * @param {Object} namesMap  fake→real mapping
 * @returns {{ text: string, count: number }}
 */
function globalNameReplace(text, namesMap) {
  let result = text;
  let count = 0;

  // Sort fake names longest-first to prevent partial matches
  const fakeNames = Object.keys(namesMap).sort((a, b) => b.length - a.length);

  for (const fakeName of fakeNames) {
    const realName = namesMap[fakeName];
    const escaped = escapeRegex(fakeName);
    // Build a regex that matches the fake name (case-insensitive) at word boundaries
    const regex = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, 'gi');
    result = result.replace(regex, () => {
      count++;
      return realName;
    });
  }

  return { text: result, count };
}

/**
 * ID regex pattern: matches [S01], [S02], ..., [S999]
 */
const ID_PATTERN = /\[S\d{2,3}\]/g;

/**
 * Pattern for "Fake Name [SXX]" — the fake name immediately before an ID token.
 * Captures: (fake name) ([SXX])
 */
function buildFakeNameIdPattern(fakeNames) {
  // Sort longest first
  const sorted = [...fakeNames].sort((a, b) => b.length - a.length);
  const escaped = sorted.map(n => escapeRegex(n));
  // Match fake name (case-insensitive) followed by optional space and [SXX]
  return new RegExp(`(?<![\\w])(${escaped.join('|')})\\s*(\\[S\\d{2,3}\\])`, 'gi');
}

/**
 * Run the ID replacement pass.
 * Handles both "FakeName [S01]" combined patterns and standalone "[S01]" tokens.
 *
 * @param {string} text
 * @param {Object} mapping
 * @returns {{ text: string, idMatches: number }}
 */
function idPass(text, mapping) {
  let result = text;
  let idMatches = 0;
  const { ids, idToFake } = mapping;
  const fakeNames = Object.keys(mapping.names || {});

  // First pass: replace "FakeName [SXX]" combined patterns
  if (fakeNames.length > 0) {
    const combinedPattern = buildFakeNameIdPattern(fakeNames);
    result = result.replace(combinedPattern, (match, fakePart, idPart) => {
      const idKey = idPart.slice(1, -1); // Remove brackets: [S01] → S01
      const realName = ids[idKey];
      if (realName) {
        idMatches++;
        return realName;
      }
      return match;
    });
  }

  // Second pass: replace remaining standalone [SXX] tokens
  result = result.replace(ID_PATTERN, (match) => {
    const idKey = match.slice(1, -1); // [S01] → S01
    const realName = ids[idKey];
    if (realName) {
      idMatches++;
      return realName;
    }
    return match;
  });

  return { text: result, idMatches };
}

/**
 * Detect and replace fake names in markdown table rows.
 * Looks for tables with a Student/Name column header.
 *
 * @param {string} text
 * @param {Object} namesMap  fake→real
 * @returns {{ text: string, count: number }}
 */
function structuredTablePass(text, namesMap) {
  let count = 0;
  const lines = text.split('\n');
  const result = [];

  // Sort fake names longest-first
  const fakeNames = Object.keys(namesMap).sort((a, b) => b.length - a.length);

  let nameColIndex = -1;
  let inTable = false;
  let headerSeen = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect table header row: must contain | and a Student/Name column
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && !inTable) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(c => c !== '');
      nameColIndex = cells.findIndex(c =>
        /^(student|name|pupil|student\s+name|pupil\s+name)$/i.test(c)
      );
      if (nameColIndex >= 0) {
        inTable = true;
        headerSeen = false;
        result.push(line);
        continue;
      }
    }

    // Skip separator row (---|---|---)
    if (inTable && !headerSeen && /^\|[\s\-:|]+\|$/.test(trimmed)) {
      headerSeen = true;
      result.push(line);
      continue;
    }

    // Process data rows in the table
    if (inTable && headerSeen && trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|');
      // cells[0] and cells[last] are empty strings from leading/trailing |
      const dataCells = cells.slice(1, -1);
      if (nameColIndex < dataCells.length) {
        let cell = dataCells[nameColIndex];
        for (const fakeName of fakeNames) {
          const realName = namesMap[fakeName];
          const regex = new RegExp(escapeRegex(fakeName), 'gi');
          const before = cell;
          cell = cell.replace(regex, () => {
            count++;
            return realName;
          });
        }
        dataCells[nameColIndex] = cell;
        result.push('|' + dataCells.join('|') + '|');
        continue;
      }
    }

    // End of table
    if (inTable && headerSeen && !(trimmed.startsWith('|') && trimmed.endsWith('|'))) {
      inTable = false;
      nameColIndex = -1;
    }

    // Detect "STUDENT: FakeName" or "Student: FakeName" lines — handled separately
    result.push(line);
  }

  return { text: result.join('\n'), count };
}

/**
 * Replace fake names in "STUDENT: FakeName" or "Student: FakeName" patterns.
 *
 * @param {string} text
 * @param {Object} namesMap  fake→real
 * @returns {{ text: string, count: number }}
 */
function structuredPrefixPass(text, namesMap) {
  let count = 0;

  // Sort fake names longest-first
  const fakeNames = Object.keys(namesMap).sort((a, b) => b.length - a.length);

  for (const fakeName of fakeNames) {
    const realName = namesMap[fakeName];
    const escaped = escapeRegex(fakeName);
    // Match "Student:" or "STUDENT:" prefix followed by the fake name
    const regex = new RegExp(`((?:student|STUDENT|Student):\\s*)${escaped}`, 'gi');
    text = text.replace(regex, (match, prefix) => {
      count++;
      return prefix + realName;
    });
  }

  return { text, count };
}

/**
 * Walk a JSON value recursively, replacing IDs and fake names in all string values.
 *
 * @param {*} value
 * @param {Object} mapping
 * @param {Object} stats  mutated in place
 * @returns {*}
 */
function walkJson(value, mapping, stats) {
  if (typeof value === 'string') {
    let result = value;

    // Replace IDs
    result = result.replace(ID_PATTERN, (match) => {
      const idKey = match.slice(1, -1);
      const realName = mapping.ids[idKey];
      if (realName) {
        stats.idMatches++;
        return realName;
      }
      return match;
    });

    // Replace fake names (longest first)
    const fakeNames = Object.keys(mapping.names).sort((a, b) => b.length - a.length);
    for (const fakeName of fakeNames) {
      const realName = mapping.names[fakeName];
      const regex = new RegExp(escapeRegex(fakeName), 'gi');
      result = result.replace(regex, () => {
        stats.nameMatches++;
        return realName;
      });
    }

    return result;
  }

  if (Array.isArray(value)) {
    return value.map(item => walkJson(item, mapping, stats));
  }

  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = walkJson(value[key], mapping, stats);
    }
    return out;
  }

  return value;
}

/**
 * Find fake names that remain unreplaced in the text.
 *
 * @param {string} text
 * @param {Object} namesMap
 * @returns {string[]}
 */
function findUnmatched(text, namesMap) {
  const unmatched = [];
  const normalised = nfkc(text).toLowerCase();
  for (const fakeName of Object.keys(namesMap)) {
    if (normalised.includes(nfkc(fakeName).toLowerCase())) {
      unmatched.push(fakeName);
    }
  }
  return unmatched;
}

/**
 * De-anonymise text using the provided mapping and strategy.
 *
 * @param {string} text  The AI-generated text containing fake names / ID tokens
 * @param {Object} mapping  The anonymisation mapping object
 * @param {Object} [options]
 * @param {string} [options.strategy='id-first']  One of: 'id-first', 'json', 'structured-only', 'global'
 * @returns {{ text: string, unmatched: string[], stats: { idMatches: number, nameMatches: number, unmatched: string[] } }
 *          | { parsed: *, valid: true, stats: ... }
 *          | { text: string, valid: false, stats: ... }}
 */
export function deanonymise(text, mapping, options = {}) {
  const strategy = options.strategy || 'id-first';

  // NFKC normalise input text
  let normalised = nfkc(text);

  const stats = { idMatches: 0, nameMatches: 0, unmatched: [] };

  if (strategy === 'json') {
    return jsonStrategy(normalised, mapping, stats);
  }

  if (strategy === 'id-first') {
    return idFirstStrategy(normalised, mapping, stats);
  }

  if (strategy === 'structured-only') {
    return structuredOnlyStrategy(normalised, mapping, stats);
  }

  if (strategy === 'global') {
    return globalStrategy(normalised, mapping, stats);
  }

  throw new Error(`Unknown de-anonymisation strategy: ${strategy}`);
}

/**
 * id-first strategy: ID pass → structured pass → global pass.
 */
function idFirstStrategy(text, mapping, stats) {
  // 1. ID pass
  const idResult = idPass(text, mapping);
  text = idResult.text;
  stats.idMatches = idResult.idMatches;

  // 2. Structured name pass (tables + prefix lines)
  const tableResult = structuredTablePass(text, mapping.names);
  text = tableResult.text;
  stats.nameMatches += tableResult.count;

  const prefixResult = structuredPrefixPass(text, mapping.names);
  text = prefixResult.text;
  stats.nameMatches += prefixResult.count;

  // 3. Global name pass
  const globalResult = globalNameReplace(text, mapping.names);
  text = globalResult.text;
  stats.nameMatches += globalResult.count;

  stats.unmatched = findUnmatched(text, mapping.names);

  return { text, unmatched: stats.unmatched, stats };
}

/**
 * json strategy: parse JSON, walk and replace, return parsed object.
 * Falls back to id-first on parse failure.
 */
function jsonStrategy(text, mapping, stats) {
  try {
    const parsed = JSON.parse(text);
    const replaced = walkJson(parsed, mapping, stats);
    stats.unmatched = [];
    return { parsed: replaced, valid: true, stats };
  } catch (e) {
    // Fall back to id-first
    const result = idFirstStrategy(text, mapping, stats);
    return { text: result.text, valid: false, stats: result.stats };
  }
}

/**
 * structured-only strategy: ID pass + structured pass only, no global fallback.
 */
function structuredOnlyStrategy(text, mapping, stats) {
  // 1. ID pass
  const idResult = idPass(text, mapping);
  text = idResult.text;
  stats.idMatches = idResult.idMatches;

  // 2. Structured name pass (tables + prefix lines)
  const tableResult = structuredTablePass(text, mapping.names);
  text = tableResult.text;
  stats.nameMatches += tableResult.count;

  const prefixResult = structuredPrefixPass(text, mapping.names);
  text = prefixResult.text;
  stats.nameMatches += prefixResult.count;

  stats.unmatched = findUnmatched(text, mapping.names);

  return { text, unmatched: stats.unmatched, stats };
}

/**
 * global strategy: ID pass + global boundary-aware replacement.
 */
function globalStrategy(text, mapping, stats) {
  // 1. ID pass
  const idResult = idPass(text, mapping);
  text = idResult.text;
  stats.idMatches = idResult.idMatches;

  // 2. Global name pass
  const globalResult = globalNameReplace(text, mapping.names);
  text = globalResult.text;
  stats.nameMatches += globalResult.count;

  stats.unmatched = findUnmatched(text, mapping.names);

  return { text, unmatched: stats.unmatched, stats };
}
