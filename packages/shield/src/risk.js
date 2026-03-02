import generalisations from './data/generalisations.json' with { type: 'json' };

/**
 * Analyse re-identification risk of a dataset using k-anonymity and
 * rare-category detection.
 *
 * @param {Array<Array<*>>} data - Array of row arrays (no header row).
 * @param {object} config
 * @param {number[]} config.quasiIdentifiers - Column indices for k-anonymity grouping.
 * @param {Array<{index: number, name: string}>} [config.categoricalColumns] - Columns to check for rare categories.
 * @param {number|'auto'} [config.kThreshold='auto'] - Fixed k or 'auto' (k=5 for <20 rows, k=3 for >=20).
 * @returns {{ kAnonymity: object, rareCategories: Array, recommendations: string[] }}
 */
export function analyseRisk(data, config) {
  const {
    quasiIdentifiers = [],
    categoricalColumns = [],
    kThreshold = 'auto',
  } = config || {};

  const totalStudents = data.length;

  const k =
    kThreshold === 'auto'
      ? totalStudents < 20
        ? 5
        : 3
      : kThreshold;

  const kAnonymity = computeKAnonymity(data, quasiIdentifiers, k, totalStudents);
  const rareCategories = detectRareCategories(data, categoricalColumns, k);
  const recommendations = buildRecommendations(kAnonymity, rareCategories, k);

  return { kAnonymity, rareCategories, recommendations };
}

/**
 * Group rows by quasi-identifier values and flag small groups.
 *
 * @param {Array<Array<*>>} data
 * @param {number[]} qiCols
 * @param {number} k
 * @param {number} totalStudents
 * @returns {{ threshold: number, totalStudents: number, safeStudents: number, flaggedGroups: Array }}
 */
function computeKAnonymity(data, qiCols, k, totalStudents) {
  if (totalStudents === 0 || qiCols.length === 0) {
    return {
      threshold: k,
      totalStudents,
      safeStudents: totalStudents,
      flaggedGroups: [],
    };
  }

  // Build groups keyed by composite quasi-identifier string.
  const groups = new Map();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const key = qiCols.map((col) => String(row[col] ?? '')).join('\x00');
    if (!groups.has(key)) {
      groups.set(key, { attrs: qiCols.map((col) => row[col]), indices: [] });
    }
    groups.get(key).indices.push(i);
  }

  const flaggedGroups = [];
  let flaggedCount = 0;

  for (const [, group] of groups) {
    if (group.indices.length < k) {
      const attributes = {};
      qiCols.forEach((col, idx) => {
        attributes[`col${col}`] = group.attrs[idx];
      });
      flaggedGroups.push({
        attributes,
        count: group.indices.length,
        rowIndices: group.indices,
      });
      flaggedCount += group.indices.length;
    }
  }

  // Sort flagged groups by count ascending for deterministic output.
  flaggedGroups.sort((a, b) => a.count - b.count);

  return {
    threshold: k,
    totalStudents,
    safeStudents: totalStudents - flaggedCount,
    flaggedGroups,
  };
}

/**
 * Detect rare categories in categorical columns and suggest generalisations.
 *
 * @param {Array<Array<*>>} data
 * @param {Array<{index: number, name: string}>} categoricalColumns
 * @param {number} k
 * @returns {Array<{column: number, columnName: string, value: *, count: number, suggestion: string|null}>}
 */
function detectRareCategories(data, categoricalColumns, k) {
  if (!categoricalColumns || categoricalColumns.length === 0 || data.length === 0) {
    return [];
  }

  const rareThreshold = Math.min(3, k);
  const results = [];

  for (const { index, name } of categoricalColumns) {
    // Count occurrences.
    const counts = new Map();
    for (const row of data) {
      const val = row[index] ?? '';
      counts.set(val, (counts.get(val) || 0) + 1);
    }

    for (const [value, count] of counts) {
      if (count < rareThreshold) {
        const suggestion = lookupGeneralisation(name, value);
        results.push({
          column: index,
          columnName: name,
          value,
          count,
          suggestion,
        });
      }
    }
  }

  // Sort by count ascending, then by column index for determinism.
  results.sort((a, b) => a.count - b.count || a.column - b.column);

  return results;
}

/**
 * Look up a generalisation suggestion for a given category name and value.
 *
 * @param {string} categoryName - Column / category name (e.g. "SEN", "PP").
 * @param {*} value - The rare value to look up.
 * @returns {string|null}
 */
function lookupGeneralisation(categoryName, value) {
  const strValue = String(value);

  // Try exact category match first (case-insensitive key search).
  for (const [catKey, mapping] of Object.entries(generalisations)) {
    if (catKey.toLowerCase() === categoryName.toLowerCase()) {
      for (const [mapKey, suggestion] of Object.entries(mapping)) {
        if (mapKey.toLowerCase() === strValue.toLowerCase()) {
          return suggestion;
        }
      }
      // Category found but value not in mapping.
      return null;
    }
  }

  // Category not found — search all categories for the value.
  for (const [, mapping] of Object.entries(generalisations)) {
    for (const [mapKey, suggestion] of Object.entries(mapping)) {
      if (mapKey.toLowerCase() === strValue.toLowerCase()) {
        return suggestion;
      }
    }
  }

  return null;
}

/**
 * Build plain-English recommendation strings.
 *
 * @param {{ threshold: number, totalStudents: number, safeStudents: number, flaggedGroups: Array }} kAnonymity
 * @param {Array} rareCategories
 * @param {number} k
 * @returns {string[]}
 */
function buildRecommendations(kAnonymity, rareCategories, k) {
  const recommendations = [];
  const { totalStudents, safeStudents, flaggedGroups } = kAnonymity;

  if (totalStudents === 0) {
    recommendations.push('No data to analyse.');
    return recommendations;
  }

  const flaggedCount = totalStudents - safeStudents;

  if (flaggedGroups.length === 0) {
    recommendations.push(
      `All ${totalStudents} students are in groups of ${k}+. No re-identification risk detected from quasi-identifiers.`
    );
  } else {
    recommendations.push(
      `${safeStudents} of ${totalStudents} students are in groups of ${k}+. ` +
        `${flaggedCount} student${flaggedCount === 1 ? ' has' : 's have'} attribute combinations shared by fewer than ${k} others.`
    );

    for (const group of flaggedGroups) {
      const attrDesc = Object.entries(group.attributes)
        .map(([key, val]) => `${key}=${val}`)
        .join(', ');
      recommendations.push(
        `Group (${attrDesc}): ${group.count} student${group.count === 1 ? '' : 's'} — consider generalising or suppressing distinguishing attributes.`
      );
    }
  }

  if (rareCategories.length > 0) {
    for (const rare of rareCategories) {
      let msg = `Rare category in "${rare.columnName}": "${rare.value}" appears only ${rare.count} time${rare.count === 1 ? '' : 's'}.`;
      if (rare.suggestion) {
        msg += ` Consider generalising to "${rare.suggestion}".`;
      }
      recommendations.push(msg);
    }
  }

  return recommendations;
}
