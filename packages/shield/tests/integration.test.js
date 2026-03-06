import { describe, it, expect } from 'vitest';
import { Shield } from '../src/index.js';
import { mulberry32 } from '../src/prng.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import prngFixture from '../../../test-fixtures/prng-sequence-seed42.json' with { type: 'json' };
import anonymisedFixture from '../../../test-fixtures/anonymised-seed42.json' with { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleCSV = readFileSync(resolve(__dirname, '../../../test-fixtures/sample-dataset.csv'), 'utf-8');

describe('Shield class', () => {
  it('constructs with defaults', () => {
    const shield = new Shield();
    expect(shield).toBeDefined();
    expect(shield._mode).toBe('accurate');
  });

  it('constructs with custom config', () => {
    const shield = new Shield({
      mode: 'anonymous',
      seed: 42,
      noise: { percent: 0.05, boundaries: [40, 50, 60, 70, 80] },
      gender: 'neutral',
      kThreshold: 'auto',
    });
    expect(shield._mode).toBe('anonymous');
    expect(shield._seed).toBe(42);
  });

  it('exposes all 6 public methods', () => {
    const shield = new Shield({ seed: 42 });
    expect(typeof shield.anonymise).toBe('function');
    expect(typeof shield.deanonymise).toBe('function');
    expect(typeof shield.analyseRisk).toBe('function');
    expect(typeof shield.scanText).toBe('function');
    expect(typeof shield.detectColumns).toBe('function');
    expect(typeof shield.addNoise).toBe('function');
  });
});

describe('Shield.anonymise — accurate mode', () => {
  it('anonymises the sample dataset', () => {
    const shield = new Shield({ mode: 'accurate', seed: 42 });
    const result = shield.anonymise(sampleCSV);

    expect(result.anonymised).toBeDefined();
    expect(result.mapping).toBeDefined();
    expect(result.risks).toBeDefined();
    expect(result.flags).toBeDefined();

    // 22 students
    expect(result.anonymised.rows.length).toBe(22);
    // Headers preserved
    expect(result.anonymised.headers[0]).toBe('Name');

    // Mapping has 22 entries
    expect(Object.keys(result.mapping.ids).length).toBe(22);
    expect(Object.keys(result.mapping.names).length).toBe(22);
  });

  it('replaces all real names with fake names + ID tokens', () => {
    const shield = new Shield({ mode: 'accurate', seed: 42 });
    const result = shield.anonymise(sampleCSV);

    const realNames = [
      'James Chen', 'Aisha Rahman', 'Connor Murphy', 'Priya Kapoor',
      'Oliver Thompson', 'Keisha Campbell', 'Rhys Davies', 'Sofia Martinez',
    ];

    // No real names should appear in anonymised data
    const allCells = result.anonymised.rows.flat().join(' ');
    for (const name of realNames) {
      expect(allCells).not.toContain(name);
    }

    // All name cells should have [SXX] format
    for (const row of result.anonymised.rows) {
      expect(row[0]).toMatch(/\[S\d{2}\]/);
    }
  });

  it('preserves exact scores in accurate mode', () => {
    const shield = new Shield({ mode: 'accurate', seed: 42 });
    const result = shield.anonymise(sampleCSV);

    // Collect all scores from anonymised data
    const scores = result.anonymised.rows.map((r) => r[5]);
    // Original scores (unshuffled): 72, 58, 65, 78, 88, 45, 61, 70, 82, 54, ...
    // After shuffle the order changes, but all original values should be present
    const originalScores = ['72', '58', '65', '78', '88', '45', '61', '70', '82', '54',
      '67', '75', '42', '79', '55', '83', '69', '48', '73', '86', '77', '64'];
    expect(scores.sort()).toEqual(originalScores.sort());
  });

  it('shuffles rows (order differs from original)', () => {
    const shield = new Shield({ mode: 'accurate', seed: 42 });
    const result = shield.anonymise(sampleCSV);

    // The rows should be in a different order than the original
    // We check that not all rows are in original position by checking scores
    const originalScores = ['72', '58', '65', '78', '88', '45', '61', '70', '82', '54',
      '67', '75', '42', '79', '55', '83', '69', '48', '73', '86', '77', '64'];
    const shuffledScores = result.anonymised.rows.map((r) => r[5]);
    expect(shuffledScores).not.toEqual(originalScores);
  });
});

describe('Shield.anonymise — anonymous mode', () => {
  it('adds noise to numeric columns', () => {
    const shield = new Shield({
      mode: 'anonymous',
      seed: 42,
      noise: { percent: 0.05, boundaries: [40, 50, 60, 70, 80] },
    });
    const result = shield.anonymise(sampleCSV);

    // Scores should differ from originals (at least some)
    const originalScores = new Set(['72', '58', '65', '78', '88', '45', '61', '70', '82', '54',
      '67', '75', '42', '79', '55', '83', '69', '48', '73', '86', '77', '64']);
    const anonScores = result.anonymised.rows.map((r) => r[5]);

    // At least some scores should have changed (noise applied)
    let changed = 0;
    for (const s of anonScores) {
      if (!originalScores.has(s)) changed++;
    }
    // With noise, we expect at least a few to change
    expect(changed).toBeGreaterThan(0);
  });
});

describe('Shield.anonymise — formula injection protection', () => {
  it('prefixes cells starting with =, +, -, @', () => {
    const shield = new Shield({ mode: 'accurate', seed: 42 });
    const data = {
      headers: ['Name', 'Notes'],
      rows: [
        ['Test Student', '=SUM(A1:A10)'],
        ['Another Student', '+cmd'],
        ['Third Student', '-calculation'],
        ['Fourth Student', '@mention'],
        ['Fifth Student', 'Normal text'],
      ],
    };
    const result = shield.anonymise(data, { nameColIndex: 0 });

    // Find the cells that had formula-like content
    const allNotes = result.anonymised.rows.map((r) => r[1]);
    const formulaCells = allNotes.filter((n) => n.startsWith("'"));
    expect(formulaCells.length).toBe(4);
    expect(allNotes).toContain('Normal text');
  });
});

describe('Shield — full round-trip', () => {
  it('anonymise → deanonymise restores all real names', () => {
    const shield = new Shield({ mode: 'accurate', seed: 42 });
    const result = shield.anonymise(sampleCSV);

    // Build a mock AI response using the anonymised names and IDs
    const anonRows = result.anonymised.rows;
    const lines = anonRows.map((r) => `${r[0]} scored ${r[5]}% with ${r[6]}% attendance.`);
    const aiResponse = lines.join('\n');

    const deResult = shield.deanonymise(aiResponse, result.mapping);

    // All real names should appear in the de-anonymised text
    const realNames = Object.values(result.mapping.ids);
    for (const name of realNames) {
      expect(deResult.text).toContain(name);
    }

    // No fake names should remain
    const fakeNames = Object.keys(result.mapping.names);
    for (const fake of fakeNames) {
      expect(deResult.text).not.toContain(fake);
    }

    // No [SXX] tokens should remain
    expect(deResult.text).not.toMatch(/\[S\d{2}\]/);

    // Stats
    expect(deResult.stats.unmatched.length).toBe(0);
  });
});

describe('Shield.scanText — sample dataset traps', () => {
  it('catches sibling name "Emily"', () => {
    const shield = new Shield({ seed: 42 });
    const text = "James's sister Emily also struggled with this topic";
    const result = shield.scanText(text, {
      knownNames: ['James Chen', 'Emily Barker'],
    });
    const nameFlags = result.flags.filter((f) => f.type === 'name');
    const emilyFlag = nameFlags.find((f) => /emily/i.test(f.value));
    expect(emilyFlag).toBeDefined();
  });

  it('catches medical term "epilepsy"', () => {
    const shield = new Shield({ seed: 42 });
    const text = "Has been absent due to hospital appointments for epilepsy treatment";
    const result = shield.scanText(text);
    const medFlags = result.flags.filter((f) => f.type === 'keyword' && f.subtype === 'medical');
    const epilepsyFlag = medFlags.find((f) => /epilepsy/i.test(f.value));
    expect(epilepsyFlag).toBeDefined();
  });

  it('catches teacher name "Patel" when in known names', () => {
    const shield = new Shield({ seed: 42 });
    const text = "As discussed with Mrs Patel in the review meeting";
    const result = shield.scanText(text, {
      staffNames: ['Mrs Patel'],
    });
    const nameFlags = result.flags.filter((f) => f.type === 'name');
    const patelFlag = nameFlags.find((f) => /patel/i.test(f.value));
    expect(patelFlag).toBeDefined();
  });

  it('catches date "15/03/2024"', () => {
    const shield = new Shield({ seed: 42 });
    const text = "Behaviour has improved significantly since the incident on 15/03/2024";
    const result = shield.scanText(text);
    const dateFlags = result.flags.filter((f) => f.type === 'date');
    expect(dateFlags.length).toBeGreaterThan(0);
    expect(dateFlags[0].value).toBe('15/03/2024');
  });

  it('catches family term "mother"', () => {
    const shield = new Shield({ seed: 42 });
    const text = "His mother called to discuss progress";
    const result = shield.scanText(text);
    const famFlags = result.flags.filter((f) => f.type === 'keyword' && f.subtype === 'family');
    const motherFlag = famFlags.find((f) => /mother/i.test(f.value));
    expect(motherFlag).toBeDefined();
  });

  it('catches "hospital" as medical keyword', () => {
    const shield = new Shield({ seed: 42 });
    const text = "Has been absent due to hospital appointments for epilepsy treatment";
    const result = shield.scanText(text);
    const medFlags = result.flags.filter((f) => f.type === 'keyword' && f.subtype === 'medical');
    const hospitalFlag = medFlags.find((f) => /hospital/i.test(f.value));
    expect(hospitalFlag).toBeDefined();
  });
});

describe('Shield.analyseRisk — sample dataset', () => {
  it('flags the unique EHCP + PP + high-score student', () => {
    const shield = new Shield({ seed: 42, kThreshold: 'auto' });

    // Parse sample dataset manually
    const lines = sampleCSV.trim().split('\n').slice(1);
    const rows = lines.map((l) => {
      const cells = l.split(',');
      return cells;
    });

    // Quasi-identifiers: Gender(1), SEN(2), PP(3), EAL(4)
    const result = shield.analyseRisk(rows, {
      quasiIdentifiers: [1, 2, 3, 4],
      categoricalColumns: [
        { index: 2, name: 'SEN' },
        { index: 3, name: 'PP' },
      ],
      kThreshold: 'auto',
    });

    // k=3 for ≥20 students
    expect(result.kAnonymity.threshold).toBe(3);
    expect(result.kAnonymity.totalStudents).toBe(22);

    // EHCP should be flagged as rare category
    const ehcpRare = result.rareCategories.find((r) => r.value === 'EHCP');
    expect(ehcpRare).toBeDefined();
    expect(ehcpRare.count).toBe(1);
    expect(ehcpRare.suggestion).toBe('SEN: Yes');
  });
});

describe('Shield.detectColumns', () => {
  it('detects column types from sample dataset', () => {
    const shield = new Shield({ seed: 42 });
    const lines = sampleCSV.trim().split('\n');
    const headers = lines[0].split(',');
    const rows = lines.slice(1).map((l) => l.split(','));

    const result = shield.detectColumns(headers, rows);
    expect(result.columns.length).toBe(8);

    // Name column detected
    const nameCol = result.columns.find((c) => c.name === 'Name');
    expect(nameCol).toBeDefined();
    expect(nameCol.type).toBe('name');
  });
});

describe('Shield.addNoise', () => {
  it('adds noise to an array of values', () => {
    const shield = new Shield({ seed: 42, noise: { percent: 0.05 } });
    const values = [50, 60, 70, 80, 90];
    const result = shield.addNoise(values, { maxValue: 100 });
    expect(result.values.length).toBe(5);
    // All values should be numbers
    for (const v of result.values) {
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe('Determinism — same seed produces identical output', () => {
  it('anonymise is deterministic with same seed', () => {
    const shield1 = new Shield({ mode: 'accurate', seed: 42 });
    const shield2 = new Shield({ mode: 'accurate', seed: 42 });

    const result1 = shield1.anonymise(sampleCSV);
    const result2 = shield2.anonymise(sampleCSV);

    expect(result1.anonymised.rows).toEqual(result2.anonymised.rows);
    expect(result1.mapping).toEqual(result2.mapping);
  });

  it('different seeds produce different output', () => {
    const shield1 = new Shield({ mode: 'accurate', seed: 42 });
    const shield2 = new Shield({ mode: 'accurate', seed: 99 });

    const result1 = shield1.anonymise(sampleCSV);
    const result2 = shield2.anonymise(sampleCSV);

    expect(result1.anonymised.rows).not.toEqual(result2.anonymised.rows);
    expect(result1.mapping).not.toEqual(result2.mapping);
  });
});

describe('BLOCKING: Sample dataset regression — all traps caught', () => {
  it('scanner catches ALL planted traps', () => {
    const shield = new Shield({ seed: 42 });

    // Parse all comments from the sample dataset
    const lines = sampleCSV.trim().split('\n').slice(1);
    const rows = lines.map((l) => {
      // Handle potential commas in quoted fields
      const cells = [];
      let current = '';
      let inQuotes = false;
      for (const ch of l) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { cells.push(current); current = ''; continue; }
        current += ch;
      }
      cells.push(current);
      return cells;
    });

    const knownNames = rows.map((r) => r[0]);
    // Emily is James Chen's sister — simulating sibling names provided by teacher or
    // detected as a first name appearing in comments. In the full app, the teacher
    // would flag sibling names during the review step.
    const siblingNames = ['Emily'];
    const allKnownNames = [...knownNames, ...siblingNames];
    const allComments = rows.map((r) => r[7] || '').filter((c) => c.trim());

    let allFlags = [];
    for (const comment of allComments) {
      const result = shield.scanText(comment, {
        knownNames: allKnownNames,
        staffNames: ['Mrs Patel'],
      });
      allFlags = allFlags.concat(result.flags);
    }

    // Trap 1: Sibling name "Emily" flagged
    const emilyFlag = allFlags.find((f) => f.type === 'name' && /emily/i.test(f.value));
    expect(emilyFlag, 'Trap 1: sibling name "Emily" must be flagged').toBeDefined();

    // Trap 2: Medical term "epilepsy" flagged
    const epilepsyFlag = allFlags.find((f) => f.type === 'keyword' && /epilepsy/i.test(f.value));
    expect(epilepsyFlag, 'Trap 2: medical term "epilepsy" must be flagged').toBeDefined();

    // Trap 4: Teacher name "Patel" flagged
    const patelFlag = allFlags.find((f) => f.type === 'name' && /patel/i.test(f.value));
    expect(patelFlag, 'Trap 4: teacher name "Patel" must be flagged').toBeDefined();

    // Trap 7: Date "15/03/2024" flagged
    const dateFlag = allFlags.find((f) => f.type === 'date' && f.value === '15/03/2024');
    expect(dateFlag, 'Trap 7: date "15/03/2024" must be flagged').toBeDefined();

    // Trap 8: Family term "mother" flagged
    const motherFlag = allFlags.find((f) => f.type === 'keyword' && /mother/i.test(f.value));
    expect(motherFlag, 'Trap 8: family term "mother" must be flagged').toBeDefined();

    // Trap 2 bonus: "hospital" flagged as medical keyword
    const hospitalFlag = allFlags.find((f) => f.type === 'keyword' && /hospital/i.test(f.value));
    expect(hospitalFlag, 'Bonus: "hospital" must be flagged as medical keyword').toBeDefined();
  });

  it('k-anonymity flags the unique EHCP+PP+high-score student', () => {
    const shield = new Shield({ seed: 42 });
    const lines = sampleCSV.trim().split('\n').slice(1);
    const rows = lines.map((l) => l.split(','));

    const result = shield.analyseRisk(rows, {
      quasiIdentifiers: [1, 2, 3, 4], // Gender, SEN, PP, EAL
      categoricalColumns: [{ index: 2, name: 'SEN' }],
      kThreshold: 'auto',
    });

    // The EHCP student (Oliver Thompson: M, EHCP, Yes, No) should be in a flagged group
    const flaggedGroups = result.kAnonymity.flaggedGroups;
    // At minimum, the unique EHCP combination should be flagged
    const ehcpGroup = flaggedGroups.find((g) =>
      Object.values(g.attributes).includes('EHCP')
    );
    expect(ehcpGroup, 'Trap 5: EHCP+PP student must be in a flagged k-anonymity group').toBeDefined();
    expect(ehcpGroup.count).toBe(1);
  });

  it('rare-category detection catches EHCP as rare', () => {
    const shield = new Shield({ seed: 42 });
    const lines = sampleCSV.trim().split('\n').slice(1);
    const rows = lines.map((l) => l.split(','));

    const result = shield.analyseRisk(rows, {
      quasiIdentifiers: [1, 2, 3],
      categoricalColumns: [{ index: 2, name: 'SEN' }],
    });

    const ehcpRare = result.rareCategories.find((r) => r.value === 'EHCP');
    expect(ehcpRare, 'EHCP must be detected as rare category').toBeDefined();
    expect(ehcpRare.count).toBe(1);
    expect(ehcpRare.suggestion).toBe('SEN: Yes');
  });
});

describe('Shield.scanText — cleaned text output', () => {
  it('returns cleaned text with redaction placeholders', () => {
    const shield = new Shield({ seed: 42 });
    const text = "James Chen has epilepsy and his mother called on 15/03/2024";
    const result = shield.scanText(text, {
      knownNames: ['James Chen'],
    });
    expect(result.cleaned).toBeDefined();
    expect(result.cleaned).not.toContain('James Chen');
    expect(result.cleaned).not.toContain('epilepsy');
    expect(result.cleaned).not.toContain('mother');
    expect(result.cleaned).not.toContain('15/03/2024');
    expect(result.cleaned).toContain('[REDACTED NAME]');
    expect(result.cleaned).toContain('[ADDITIONAL NEEDS]');
    expect(result.cleaned).toContain('[PARENT/GUARDIAN]');
    expect(result.cleaned).toContain('[REDACTED DATE]');
  });

  it('returns original text when no flags found', () => {
    const shield = new Shield({ seed: 42 });
    const text = "Good progress this term";
    const result = shield.scanText(text);
    expect(result.cleaned).toBe(text);
  });

  it('returns empty string for empty input', () => {
    const shield = new Shield({ seed: 42 });
    const result = shield.scanText('');
    expect(result.cleaned).toBe('');
  });
});

describe('Shield.anonymise — derived grade and attendance bands for k-anonymity', () => {
  it('includes grade bands as quasi-identifiers in risk analysis', () => {
    const shield = new Shield({ mode: 'accurate', seed: 42 });
    const result = shield.anonymise(sampleCSV);

    // The risks should reflect more granular groupings due to grade bands
    expect(result.risks.kAnonymity).toBeDefined();
    expect(result.risks.kAnonymity.totalStudents).toBe(22);
    // With grade + attendance bands, more students should be flagged than with
    // just categorical columns alone
    expect(result.risks.kAnonymity.flaggedGroups.length).toBeGreaterThan(0);
  });

  it('derives attendance bands for risk analysis', () => {
    const shield = new Shield({ mode: 'accurate', seed: 42 });
    const result = shield.anonymise(sampleCSV);

    // The low-attendance student (74%) should contribute to a unique group
    // via the <80% attendance band
    const recommendations = result.risks.recommendations;
    expect(recommendations.length).toBeGreaterThan(0);
  });
});

describe('buildBlockedTokens — accepts flag objects with .value', () => {
  it('accepts flags with .value property (scanner format)', () => {
    const { buildBlockedTokens } = require('../src/anonymiser.js');
    const rows = [['Alice Smith'], ['Bob Jones']];
    const flags = [{ value: 'Emily', type: 'name' }, { value: 'Patel', type: 'name' }];
    const blocked = buildBlockedTokens(rows, 0, flags);
    expect(blocked.has('emily')).toBe(true);
    expect(blocked.has('patel')).toBe(true);
  });

  it('still accepts flags with .token property (legacy)', () => {
    const { buildBlockedTokens } = require('../src/anonymiser.js');
    const rows = [['Alice Smith']];
    const flags = [{ token: 'sibling' }];
    const blocked = buildBlockedTokens(rows, 0, flags);
    expect(blocked.has('sibling')).toBe(true);
  });

  it('still accepts plain string flags', () => {
    const { buildBlockedTokens } = require('../src/anonymiser.js');
    const rows = [['Alice Smith']];
    const flags = ['Emily', 'Henderson'];
    const blocked = buildBlockedTokens(rows, 0, flags);
    expect(blocked.has('emily')).toBe(true);
    expect(blocked.has('henderson')).toBe(true);
  });
});

describe('shared fixture validation', () => {
  it('should produce identical PRNG sequence for seed=42', () => {
    const prng = mulberry32(42);
    for (let i = 0; i < prngFixture.length; i++) {
      const val = prng();
      expect(val).toBeCloseTo(prngFixture[i], 10);
    }
  });

  it('should produce identical anonymised output for seed=42', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const csv = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../../test-fixtures/sample-dataset.csv'),
      'utf-8'
    );

    const shield = new Shield({ mode: 'accurate', seed: 42, gender: 'aware' });
    const result = shield.anonymise(csv);

    // Validate headers match
    expect(result.anonymised.headers).toEqual(anonymisedFixture.headers);

    // Validate row count
    expect(result.anonymised.rows.length).toBe(anonymisedFixture.rows.length);

    // Validate each row matches
    for (let i = 0; i < anonymisedFixture.rows.length; i++) {
      expect(result.anonymised.rows[i]).toEqual(anonymisedFixture.rows[i]);
    }

    // Validate mapping matches
    expect(result.mapping.ids).toEqual(anonymisedFixture.mapping.ids);
    expect(result.mapping.names).toEqual(anonymisedFixture.mapping.names);
    expect(result.mapping.nameToId).toEqual(anonymisedFixture.mapping.nameToId);
    expect(result.mapping.idToFake).toEqual(anonymisedFixture.mapping.idToFake);
  });
});

describe('No forbidden functions in source', () => {
  it('does not use Math.random() in any source file', () => {
    const { readdirSync } = require('fs');
    const srcDir = resolve(__dirname, '../src');
    const files = readdirSync(srcDir, { recursive: true });

    for (const file of files) {
      if (typeof file === 'string' && file.endsWith('.js')) {
        const content = readFileSync(resolve(srcDir, file), 'utf-8');
        // Strip comments before checking (avoid false positives from JSDoc)
        const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        expect(stripped, `${file} must not use Math.random()`).not.toMatch(/Math\.random\s*\(/);
      }
    }
  });

  it('does not use Math.round() in any source file', () => {
    const { readdirSync } = require('fs');
    const srcDir = resolve(__dirname, '../src');
    const files = readdirSync(srcDir, { recursive: true });

    for (const file of files) {
      if (typeof file === 'string' && file.endsWith('.js')) {
        const content = readFileSync(resolve(srcDir, file), 'utf-8');
        const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        expect(stripped, `${file} must not use Math.round()`).not.toMatch(/Math\.round\s*\(/);
      }
    }
  });
});
