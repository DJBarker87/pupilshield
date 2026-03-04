import { shuffle } from './prng.js';
import names from './data/names.json' with { type: 'json' };

/**
 * Build a set of blocked tokens from student names, flags, and staff names.
 * All tokens are lowercased for case-insensitive matching.
 *
 * @param {Array<Array<string>>} rows - Data rows (no header)
 * @param {number} nameColIndex - Index of the name column
 * @param {Array<string|{value: string}|{token: string}>} [flags] - Flagged tokens from scanner
 * @param {string[]} [staffNames] - Staff names to block
 * @returns {Set<string>} Set of blocked tokens (lowercased)
 */
export function buildBlockedTokens(rows, nameColIndex, flags = [], staffNames = []) {
  const blocked = new Set();

  // Add all real student first names and surnames individually
  for (const row of rows) {
    const fullName = row[nameColIndex];
    if (typeof fullName !== 'string') continue;
    const parts = fullName.trim().split(/\s+/);
    for (const part of parts) {
      if (part.length > 0) {
        blocked.add(part.toLowerCase());
      }
    }
  }

  // Add all flagged tokens
  if (flags) {
    for (const flag of flags) {
      const token = typeof flag === 'string' ? flag : (flag.value || flag.token);
      if (token) {
        blocked.add(token.toLowerCase());
      }
    }
  }

  // Add all staff names (split into individual parts)
  if (staffNames) {
    for (const name of staffNames) {
      const parts = name.trim().split(/\s+/);
      for (const part of parts) {
        if (part.length > 0) {
          blocked.add(part.toLowerCase());
        }
      }
    }
  }

  return blocked;
}

/**
 * Select a name from a name list using the PRNG, avoiding blocked tokens.
 * Consumes one PRNG call per attempt.
 *
 * @param {string[]} nameList - Array of names to choose from
 * @param {Set<string>} blockedTokens - Tokens to avoid (lowercased)
 * @param {Set<string>} usedNames - Already-used names to avoid reuse (lowercased)
 * @param {function(): number} prng - PRNG function
 * @returns {string} Selected name
 */
function selectName(nameList, blockedTokens, usedNames, prng) {
  const maxAttempts = nameList.length * 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const index = Math.floor(prng() * nameList.length);
    const name = nameList[index];
    const nameLower = name.toLowerCase();
    if (!blockedTokens.has(nameLower) && !usedNames.has(nameLower)) {
      return name;
    }
  }
  // Fallback: exhaustive search for any unblocked, unused name
  for (const name of nameList) {
    const nameLower = name.toLowerCase();
    if (!blockedTokens.has(nameLower) && !usedNames.has(nameLower)) {
      return name;
    }
  }
  throw new Error('Unable to find a non-blocked, unused name. Name bank exhausted.');
}

/**
 * Determine which first-name list to use based on gender.
 *
 * @param {string|undefined} gender - Gender value from the row
 * @param {string} genderMode - 'aware' or 'neutral'
 * @returns {string[]} Array of first names to choose from
 */
function getFirstNameList(gender, genderMode) {
  if (genderMode === 'neutral') {
    return names.neutral;
  }
  if (gender) {
    const g = gender.toLowerCase().trim();
    if (g === 'm' || g === 'male') return names.male;
    if (g === 'f' || g === 'female') return names.female;
    if (g === 'x' || g === 'non-binary' || g === 'nonbinary' || g === 'other') return names.neutral;
  }
  // Default: combine all lists
  return [...names.male, ...names.female, ...names.neutral];
}

/**
 * Normalise a name from "Surname, Firstname" to "Firstname Surname" format.
 * If the name doesn't contain a comma, returns it unchanged.
 *
 * @param {string} name
 * @returns {string}
 */
function normaliseNameOrder(name) {
  if (typeof name !== 'string') return name;
  const commaIndex = name.indexOf(',');
  if (commaIndex === -1) return name;
  const before = name.slice(0, commaIndex).trim();
  const after = name.slice(commaIndex + 1).trim();
  if (before && after) return `${after} ${before}`;
  return name;
}

/**
 * Anonymise names in data rows, replacing real names with fake names and ID tokens.
 *
 * PRNG consumption order: one call for first name index, one for surname index, per student.
 *
 * @param {Array<Array<string>>} rows - Data rows (no header)
 * @param {number} nameColIndex - Index of the name column
 * @param {function(): number} prng - PRNG function
 * @param {object} [options] - Options
 * @param {number} [options.genderColIndex] - Index of gender column for gender-aware naming
 * @param {string} [options.genderMode='aware'] - 'aware' or 'neutral'
 * @param {Set<string>} [options.blockedTokens] - Set of blocked tokens (lowercased)
 * @returns {{ rows: Array<Array<string>>, mapping: object }} Anonymised rows and mapping
 */
export function anonymiseNames(rows, nameColIndex, prng, options = {}) {
  const {
    genderColIndex,
    genderMode = 'aware',
    blockedTokens = new Set()
  } = options;

  const mapping = {
    ids: {},       // { 'S01': 'Real Name' }
    names: {},     // { 'Fake Name': 'Real Name' }
    nameToId: {},  // { 'Fake Name': 'S01' }
    idToFake: {}   // { 'S01': 'Fake Name' }
  };

  const usedFirstNames = new Set();
  const usedSurnames = new Set();
  const newRows = [];

  for (let i = 0; i < rows.length; i++) {
    const row = [...rows[i]];
    const rawName = row[nameColIndex];
    const realName = normaliseNameOrder(rawName);
    const idNum = i + 1;
    const idStr = idNum < 10 ? `0${idNum}` : `${idNum}`;
    const idToken = `S${idStr}`;

    // Determine gender for name selection
    const gender = genderColIndex !== undefined ? row[genderColIndex] : undefined;
    const firstNameList = getFirstNameList(gender, genderMode);

    // Select first name (one PRNG call)
    const firstName = selectName(firstNameList, blockedTokens, usedFirstNames, prng);
    usedFirstNames.add(firstName.toLowerCase());

    // Select surname (one PRNG call)
    const surname = selectName(names.surnames, blockedTokens, usedSurnames, prng);
    usedSurnames.add(surname.toLowerCase());

    const fakeName = `${firstName} ${surname}`;

    // Store mapping — always "Firstname Surname" order for clean report output
    mapping.ids[idToken] = realName;
    mapping.names[fakeName] = realName;
    mapping.nameToId[fakeName] = idToken;
    mapping.idToFake[idToken] = fakeName;

    // Replace name column with "FakeName [SXX]" format
    row[nameColIndex] = `${fakeName} [${idToken}]`;
    newRows.push(row);
  }

  return { rows: newRows, mapping };
}

/**
 * Shuffle rows using Fisher-Yates algorithm with the seeded PRNG.
 * Returns a new array (does not mutate the input).
 *
 * @param {Array<Array>} rows - Rows to shuffle
 * @param {function(): number} prng - PRNG function
 * @returns {Array<Array>} New array with rows in shuffled order
 */
export function shuffleRows(rows, prng) {
  const copy = [...rows];
  shuffle(copy, prng);
  return copy;
}
