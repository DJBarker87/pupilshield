/**
 * @module @djb/shield
 * Main Shield class — public API for the anonymisation library.
 *
 * Usage:
 *   import { Shield } from '@djb/shield';
 *   const shield = new Shield({ mode: 'accurate', seed: 42 });
 *   const result = shield.anonymise(data, config);
 *   const output = shield.deanonymise(aiText, result.mapping);
 */

import { mulberry32 } from './prng.js';
import { anonymiseNames, shuffleRows, buildBlockedTokens } from './anonymiser.js';
import { addNoiseToColumn } from './noise.js';
import { scanText } from './scanner.js';
import { analyseRisk } from './risk.js';
import { deanonymise } from './deanonymiser.js';
import { detectColumns } from './columns.js';

/**
 * Prefix a cell value if it starts with a formula-injection character.
 * @param {string} val
 * @returns {string}
 */
function sanitiseCell(val) {
  if (typeof val !== 'string') return val;
  if (/^[=+\-@\t\r\n]/.test(val)) return `'${val}`;
  return val;
}

/**
 * Derive a grade band string from a numeric score value.
 * Uses GCSE-style bands by default: 0-39, 40-49, 50-59, 60-69, 70-79, 80-89, 90-100.
 * If custom boundaries are provided, uses those instead.
 *
 * @param {number} value - Numeric score
 * @param {number[]} [boundaries=[40,50,60,70,80,90]] - Grade boundary array
 * @returns {string} Band label, e.g. "70-79"
 */
function deriveGradeBand(value, boundaries = [40, 50, 60, 70, 80, 90]) {
  if (!Number.isFinite(value)) return '';
  for (let i = 0; i < boundaries.length; i++) {
    if (value < boundaries[i]) {
      const lower = i === 0 ? 0 : boundaries[i - 1];
      return `${lower}-${boundaries[i] - 1}`;
    }
  }
  return `${boundaries[boundaries.length - 1]}+`;
}

/**
 * Derive an attendance band string from a numeric attendance percentage.
 * Bands: <80%, 80-89%, 90-94%, 95%+
 *
 * @param {number} value - Attendance percentage
 * @returns {string} Band label, e.g. "90-94%"
 */
function deriveAttendanceBand(value) {
  if (!Number.isFinite(value)) return '';
  if (value < 80) return '<80%';
  if (value < 90) return '80-89%';
  if (value < 95) return '90-94%';
  return '95%+';
}

/**
 * Parse a CSV string into { headers, rows }.
 * Simple parser — handles quoted fields but not all edge cases.
 * For production, use Papa Parse or similar.
 *
 * @param {string} csv
 * @returns {{ headers: string[], rows: string[][] }}
 */
function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).filter((l) => l.trim() !== '').map(parseLine);
  return { headers, rows };
}

export class Shield {
  /**
   * Create a Shield instance.
   *
   * @param {object} [config]
   * @param {'accurate'|'anonymous'} [config.mode='accurate'] - Privacy mode
   * @param {number} [config.seed] - PRNG seed (Date.now() if not provided)
   * @param {object} [config.noise] - Noise configuration for anonymous mode
   * @param {number} [config.noise.percent=0.05] - Noise as fraction of maxValue
   * @param {number[]} [config.noise.boundaries] - Grade boundary array
   * @param {'aware'|'neutral'} [config.gender='aware'] - Gender mode for name assignment
   * @param {number|'auto'} [config.kThreshold='auto'] - k-anonymity threshold
   */
  constructor(config = {}) {
    this._mode = config.mode || 'accurate';
    this._seed = config.seed ?? Date.now();
    this._noise = config.noise || { percent: 0.05 };
    this._gender = config.gender || 'aware';
    this._kThreshold = config.kThreshold ?? 'auto';
    this._prng = mulberry32(this._seed);
  }

  /**
   * Full anonymisation pipeline.
   * PRNG consumption order: name selection → noise → shuffle.
   *
   * @param {string|{headers: string[], rows: string[][]}} data - CSV string or parsed data
   * @param {object} [config]
   * @param {object} [config.columns] - Column index → type mapping override
   * @param {string[]} [config.staffNames] - Staff names to include in blocked tokens
   * @param {number} [config.nameColIndex] - Name column index (auto-detected if not provided)
   * @param {number} [config.genderColIndex] - Gender column index
   * @param {number[]} [config.numericColIndices] - Numeric column indices for noise
   * @param {number} [config.maxValue=100] - Max value for numeric columns
   * @returns {{ anonymised: {headers: string[], rows: string[][]}, mapping: object, risks: object, flags: object[] }}
   */
  anonymise(data, config = {}) {
    // Parse if string
    let headers, rows;
    if (typeof data === 'string') {
      const parsed = parseCSV(data);
      headers = parsed.headers;
      rows = parsed.rows;
    } else {
      headers = data.headers;
      rows = data.rows.map((r) => [...r]);
    }

    // Detect columns if not provided
    const detected = detectColumns(headers, rows);
    const nameColIndex = config.nameColIndex ??
      detected.columns.find((c) => c.type === 'name')?.index ?? 0;
    const genderColIndex = config.genderColIndex ??
      detected.columns.find((c) => /gender/i.test(c.name))?.index;

    // Identify numeric columns
    const numericColIndices = config.numericColIndices ??
      detected.columns
        .filter((c) => c.type === 'numerical')
        .map((c) => c.index);

    // Identify free-text columns for scanning
    const freeTextIndices = detected.columns
      .filter((c) => c.type === 'free-text' || /comment|note|remark/i.test(c.name))
      .map((c) => c.index);

    // Identify categorical columns for risk analysis
    const categoricalColumns = detected.columns
      .filter((c) => c.type === 'categorical')
      .map((c) => ({ index: c.index, name: c.name }));

    // Extract known names for scanner
    const knownNames = rows.map((r) => r[nameColIndex]).filter((n) => typeof n === 'string' && n.trim());

    // Scan free-text columns
    const allFlags = [];
    for (const ftIdx of freeTextIndices) {
      for (let i = 0; i < rows.length; i++) {
        const text = rows[i][ftIdx];
        if (typeof text === 'string' && text.trim()) {
          const scanResult = scanText(text, {
            knownNames,
            staffNames: config.staffNames || [],
          });
          for (const flag of scanResult.flags) {
            allFlags.push({ ...flag, rowIndex: i, colIndex: ftIdx });
          }
        }
      }
    }

    // Build blocked tokens
    const flagTokens = allFlags.map((f) => f.value);
    const blockedTokens = buildBlockedTokens(rows, nameColIndex, flagTokens, config.staffNames || []);

    // PRNG consumption order: 1. Name selection
    const { rows: anonRows, mapping } = anonymiseNames(rows, nameColIndex, this._prng, {
      genderColIndex,
      genderMode: this._gender,
      blockedTokens,
    });

    // PRNG consumption order: 2. Noise (anonymous mode only)
    let noisedRows = anonRows;
    const perturbationFailures = {};
    if (this._mode === 'anonymous') {
      noisedRows = anonRows.map((r) => [...r]);
      const maxValue = config.maxValue || 100;
      const noisePercent = this._noise.percent || 0.05;
      const boundaries = this._noise.boundaries || null;

      for (const colIdx of numericColIndices) {
        const values = noisedRows.map((r) => {
          const v = parseFloat(r[colIdx]);
          return Number.isFinite(v) ? v : r[colIdx];
        });

        const { values: noised, perturbationFailures: failures } =
          addNoiseToColumn(values, maxValue, noisePercent, boundaries, this._prng);

        for (let i = 0; i < noisedRows.length; i++) {
          if (typeof noised[i] === 'number') {
            noisedRows[i][colIdx] = String(noised[i]);
          }
        }
        if (failures > 0) {
          perturbationFailures[colIdx] = failures;
        }
      }
    }

    // PRNG consumption order: 3. Shuffle
    const shuffledRows = shuffleRows(noisedRows, this._prng);

    // Sanitise against formula injection
    const sanitisedRows = shuffledRows.map((row) => row.map(sanitiseCell));

    // Risk analysis — derive grade bands and attendance bands as quasi-identifiers
    // per the spec's default quasi-identifier set
    const quasiIdentifiers = categoricalColumns.map((c) => c.index);
    if (genderColIndex !== undefined) quasiIdentifiers.push(genderColIndex);

    // Derive grade bands from numeric score columns and attendance bands from attendance columns
    // Append derived band columns to each row for k-anonymity analysis
    let riskRows = sanitisedRows;
    const derivedCategoricalColumns = [...categoricalColumns];
    const gradeBoundaries = this._noise.boundaries || [40, 50, 60, 70, 80, 90];

    const scoreColIndices = numericColIndices.filter((idx) =>
      /score|mark|grade|percent/i.test(headers[idx] || '')
    );
    const attendanceColIndices = numericColIndices.filter((idx) =>
      /attendance/i.test(headers[idx] || '')
    );

    if (scoreColIndices.length > 0 || attendanceColIndices.length > 0) {
      // Clone rows and append derived band columns
      riskRows = sanitisedRows.map((row) => [...row]);
      let nextColIdx = headers.length;

      for (const colIdx of scoreColIndices) {
        const bandIdx = nextColIdx++;
        for (const row of riskRows) {
          const v = parseFloat(row[colIdx]);
          row[bandIdx] = deriveGradeBand(v, gradeBoundaries);
        }
        quasiIdentifiers.push(bandIdx);
        derivedCategoricalColumns.push({ index: bandIdx, name: `${headers[colIdx] || 'Score'} Band` });
      }

      for (const colIdx of attendanceColIndices) {
        const bandIdx = nextColIdx++;
        for (const row of riskRows) {
          const v = parseFloat(row[colIdx]);
          row[bandIdx] = deriveAttendanceBand(v);
        }
        quasiIdentifiers.push(bandIdx);
        derivedCategoricalColumns.push({ index: bandIdx, name: `${headers[colIdx] || 'Attendance'} Band` });
      }
    }

    const risks = analyseRisk(riskRows, {
      quasiIdentifiers,
      categoricalColumns: derivedCategoricalColumns,
      kThreshold: this._kThreshold,
    });

    return {
      anonymised: { headers, rows: sanitisedRows },
      mapping,
      risks,
      flags: allFlags,
      detected,
      perturbationFailures,
    };
  }

  /**
   * De-anonymise AI response text.
   *
   * @param {string} text - AI-generated text with fake names / ID tokens
   * @param {object} mapping - The mapping object from anonymise()
   * @param {object} [options]
   * @param {'id-first'|'json'|'structured-only'|'global'} [options.strategy='id-first']
   * @returns {object} De-anonymisation result
   */
  deanonymise(text, mapping, options = {}) {
    return deanonymise(text, mapping, options);
  }

  /**
   * Standalone risk analysis.
   *
   * @param {string[][]|{headers: string[], rows: string[][]}} data
   * @param {object} [config]
   * @returns {object} Risk analysis results
   */
  analyseRisk(data, config = {}) {
    const rows = Array.isArray(data) ? data : data.rows;
    return analyseRisk(rows, { ...config, kThreshold: config.kThreshold || this._kThreshold });
  }

  /**
   * Standalone free-text scanning.
   *
   * @param {string} text - Text to scan
   * @param {object} [config] - Scanner configuration
   * @returns {object} Scanner results
   */
  scanText(text, config = {}) {
    return scanText(text, config);
  }

  /**
   * Standalone column detection.
   *
   * @param {string[]|{headers: string[], rows: string[][]}} headersOrData
   * @param {string[][]} [rows]
   * @returns {object} Column classifications
   */
  detectColumns(headersOrData, rows) {
    if (Array.isArray(headersOrData)) {
      return detectColumns(headersOrData, rows || []);
    }
    return detectColumns(headersOrData.headers, headersOrData.rows);
  }

  /**
   * Standalone noise application.
   *
   * @param {Array<number|string>} values - Values to noise
   * @param {object} [config]
   * @param {number} [config.maxValue=100]
   * @param {number} [config.percent=0.05]
   * @param {number[]} [config.boundaries]
   * @returns {object} Noised values
   */
  addNoise(values, config = {}) {
    const maxValue = config.maxValue || 100;
    const percent = config.percent || this._noise.percent || 0.05;
    const boundaries = config.boundaries || this._noise.boundaries || null;
    return addNoiseToColumn(values, maxValue, percent, boundaries, this._prng);
  }
}
