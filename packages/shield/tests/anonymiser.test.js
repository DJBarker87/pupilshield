import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../src/prng.js';
import { anonymiseNames, shuffleRows, buildBlockedTokens } from '../src/anonymiser.js';
import namesData from '../src/data/names.json' with { type: 'json' };

// Helper: build sample rows with names and genders
function makeSampleRows(count = 5) {
  const studentData = [
    ['Alice Smith', 'F', '85'],
    ['Bob Jones', 'M', '72'],
    ['Charlie Brown', 'M', '91'],
    ['Diana Prince', 'F', '68'],
    ['Eve Wilson', 'F', '77'],
    ['Frank Miller', 'M', '83'],
    ['Grace Lee', 'F', '90'],
    ['Henry Davis', 'M', '65'],
    ['Ivy Chen', 'F', '88'],
    ['Jack Taylor', 'M', '74'],
    ['Katie Moore', 'F', '82'],
    ['Liam White', 'M', '79'],
    ['Mia Harris', 'F', '93'],
    ['Noah Clark', 'M', '71'],
    ['Olivia Lewis', 'F', '86'],
    ['Peter Hall', 'M', '67'],
    ['Quinn Young', 'F', '78'],
    ['Ryan King', 'M', '84'],
    ['Sara Scott', 'F', '76'],
    ['Tom Green', 'M', '81'],
    ['Uma Baker', 'F', '89'],
    ['Victor Adams', 'M', '73'],
  ];
  return studentData.slice(0, count);
}

describe('anonymiseNames', () => {
  it('should produce deterministic output for seed=42', () => {
    const prng = mulberry32(42);
    const rows = makeSampleRows(3);
    const { rows: anonRows, mapping } = anonymiseNames(rows, 0, prng);

    // Result is deterministic — same seed always gives same output
    expect(anonRows.length).toBe(3);
    expect(mapping.ids['S01']).toBe('Alice Smith');
    expect(mapping.ids['S02']).toBe('Bob Jones');
    expect(mapping.ids['S03']).toBe('Charlie Brown');

    // Each row should have the "[SXX]" token
    for (let i = 0; i < anonRows.length; i++) {
      const idStr = (i + 1).toString().padStart(2, '0');
      expect(anonRows[i][0]).toContain(`[S${idStr}]`);
    }

    // Run again with same seed — should produce identical result
    const prng2 = mulberry32(42);
    const rows2 = makeSampleRows(3);
    const { rows: anonRows2, mapping: mapping2 } = anonymiseNames(rows2, 0, prng2);
    expect(anonRows2).toEqual(anonRows);
    expect(mapping2).toEqual(mapping);
  });

  it('should generate sequential ID tokens [S01] through [S22]', () => {
    const prng = mulberry32(42);
    const rows = makeSampleRows(22);
    const { rows: anonRows, mapping } = anonymiseNames(rows, 0, prng);

    expect(anonRows.length).toBe(22);
    for (let i = 0; i < 22; i++) {
      const idStr = (i + 1).toString().padStart(2, '0');
      const idToken = `S${idStr}`;
      expect(mapping.ids[idToken]).toBeDefined();
      expect(anonRows[i][0]).toContain(`[${idToken}]`);
    }
  });

  it('should not use any real name as a fake name (no collisions)', () => {
    const prng = mulberry32(42);
    const rows = makeSampleRows(10);
    const realNames = rows.map(r => r[0]);
    const realTokens = new Set();
    for (const name of realNames) {
      for (const part of name.split(/\s+/)) {
        realTokens.add(part.toLowerCase());
      }
    }

    const { mapping } = anonymiseNames(rows, 0, prng, {
      blockedTokens: realTokens
    });

    // No fake name should contain any real name token
    for (const fakeName of Object.keys(mapping.names)) {
      const fakeParts = fakeName.toLowerCase().split(/\s+/);
      for (const part of fakeParts) {
        expect(realTokens.has(part)).toBe(false);
      }
    }
  });

  it('should respect blocked tokens including staff and sibling names', () => {
    const prng = mulberry32(99);
    const rows = [
      ['Alice Smith', 'F', '85'],
      ['Bob Jones', 'M', '72'],
    ];

    // Block a large set of tokens including staff names
    const blocked = new Set([
      'alice', 'smith', 'bob', 'jones',       // real student names
      'sarah', 'thompson',                      // staff names
      'emma', 'williams',                        // sibling names
    ]);

    const { mapping } = anonymiseNames(rows, 0, prng, {
      blockedTokens: blocked
    });

    for (const fakeName of Object.keys(mapping.names)) {
      const parts = fakeName.toLowerCase().split(/\s+/);
      for (const part of parts) {
        expect(blocked.has(part)).toBe(false);
      }
    }
  });

  it('should assign gender-aware fake names when genderColIndex provided', () => {
    const prng = mulberry32(42);
    const rows = [
      ['Alice Smith', 'F', '85'],
      ['Bob Jones', 'M', '72'],
      ['Charlie Brown', 'M', '91'],
      ['Diana Prince', 'F', '68'],
    ];

    const { rows: anonRows, mapping } = anonymiseNames(rows, 0, prng, {
      genderColIndex: 1,
      genderMode: 'aware'
    });

    const maleLower = new Set(namesData.male.map(n => n.toLowerCase()));
    const femaleLower = new Set(namesData.female.map(n => n.toLowerCase()));

    // Check that female students got female first names
    for (const fakeName of Object.keys(mapping.names)) {
      const realName = mapping.names[fakeName];
      const firstName = fakeName.split(' ')[0].toLowerCase();
      const row = rows.find(r => r[0] === realName);
      if (row[1] === 'F') {
        expect(femaleLower.has(firstName)).toBe(true);
      } else if (row[1] === 'M') {
        expect(maleLower.has(firstName)).toBe(true);
      }
    }
  });

  it('should assign only neutral names in neutral mode', () => {
    const prng = mulberry32(42);
    const rows = [
      ['Alice Smith', 'F', '85'],
      ['Bob Jones', 'M', '72'],
    ];

    const { mapping } = anonymiseNames(rows, 0, prng, {
      genderMode: 'neutral'
    });

    const neutralLower = new Set(namesData.neutral.map(n => n.toLowerCase()));

    for (const fakeName of Object.keys(mapping.names)) {
      const firstName = fakeName.split(' ')[0].toLowerCase();
      expect(neutralLower.has(firstName)).toBe(true);
    }
  });

  it('should produce correct mapping structure', () => {
    const prng = mulberry32(42);
    const rows = makeSampleRows(3);
    const { mapping } = anonymiseNames(rows, 0, prng);

    // Check all four mapping dictionaries are consistent
    for (const [idToken, realName] of Object.entries(mapping.ids)) {
      const fakeName = mapping.idToFake[idToken];
      expect(fakeName).toBeDefined();
      expect(mapping.names[fakeName]).toBe(realName);
      expect(mapping.nameToId[fakeName]).toBe(idToken);
    }
  });

  it('should not mutate the original rows', () => {
    const prng = mulberry32(42);
    const rows = makeSampleRows(3);
    const originalRows = rows.map(r => [...r]);
    anonymiseNames(rows, 0, prng);
    expect(rows).toEqual(originalRows);
  });

  it('should use "FakeName [SXX]" format in the name column', () => {
    const prng = mulberry32(42);
    const rows = makeSampleRows(3);
    const { rows: anonRows } = anonymiseNames(rows, 0, prng);

    for (const row of anonRows) {
      // Format: "FirstName Surname [SXX]"
      expect(row[0]).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \[S\d{2,3}\]$/);
    }
  });

  it('should never produce duplicate fake first names or surnames', () => {
    const prng = mulberry32(42);
    const rows = makeSampleRows(22);
    const { mapping } = anonymiseNames(rows, 0, prng);

    const fakeNames = Object.keys(mapping.names);
    const firstNames = fakeNames.map(n => n.split(' ')[0].toLowerCase());
    const surnames = fakeNames.map(n => n.split(' ')[1].toLowerCase());

    expect(new Set(firstNames).size).toBe(firstNames.length);
    expect(new Set(surnames).size).toBe(surnames.length);
  });
});

describe('shuffleRows', () => {
  it('should produce deterministic shuffle for seed=42', () => {
    const prng = mulberry32(42);
    const rows = makeSampleRows(5);
    const shuffled = shuffleRows(rows, prng);

    // Run again with same seed
    const prng2 = mulberry32(42);
    const rows2 = makeSampleRows(5);
    const shuffled2 = shuffleRows(rows2, prng2);

    expect(shuffled).toEqual(shuffled2);
  });

  it('should contain all original rows (no loss, no duplicates)', () => {
    const prng = mulberry32(42);
    const rows = makeSampleRows(10);
    const originalNames = rows.map(r => r[0]).sort();
    const shuffled = shuffleRows(rows, prng);
    const shuffledNames = shuffled.map(r => r[0]).sort();

    expect(shuffledNames).toEqual(originalNames);
    expect(shuffled.length).toBe(rows.length);
  });

  it('should not mutate the original array', () => {
    const prng = mulberry32(42);
    const rows = makeSampleRows(5);
    const originalFirst = rows[0][0];
    shuffleRows(rows, prng);
    expect(rows[0][0]).toBe(originalFirst);
  });

  it('should actually change the order for non-trivial input', () => {
    const prng = mulberry32(42);
    const rows = makeSampleRows(10);
    const shuffled = shuffleRows(rows, prng);

    // With 10 rows, it's extremely unlikely that shuffle produces the same order
    const originalOrder = rows.map(r => r[0]);
    const shuffledOrder = shuffled.map(r => r[0]);
    expect(shuffledOrder).not.toEqual(originalOrder);
  });
});

describe('buildBlockedTokens', () => {
  it('should include all student first names and surnames individually', () => {
    const rows = [
      ['Alice Smith', 'F'],
      ['Bob Jones', 'M'],
    ];
    const blocked = buildBlockedTokens(rows, 0);

    expect(blocked.has('alice')).toBe(true);
    expect(blocked.has('smith')).toBe(true);
    expect(blocked.has('bob')).toBe(true);
    expect(blocked.has('jones')).toBe(true);
  });

  it('should include flagged tokens', () => {
    const rows = [['Alice Smith', 'F']];
    const flags = [
      { token: 'Diabetes' },
      { token: 'ADHD' },
    ];
    const blocked = buildBlockedTokens(rows, 0, flags);

    expect(blocked.has('diabetes')).toBe(true);
    expect(blocked.has('adhd')).toBe(true);
  });

  it('should include staff names split into parts', () => {
    const rows = [['Alice Smith', 'F']];
    const blocked = buildBlockedTokens(rows, 0, [], ['Mr John Teacher', 'Ms Sarah Helper']);

    expect(blocked.has('mr')).toBe(true);
    expect(blocked.has('john')).toBe(true);
    expect(blocked.has('teacher')).toBe(true);
    expect(blocked.has('ms')).toBe(true);
    expect(blocked.has('sarah')).toBe(true);
    expect(blocked.has('helper')).toBe(true);
  });

  it('should handle empty inputs gracefully', () => {
    const blocked = buildBlockedTokens([], 0);
    expect(blocked.size).toBe(0);
  });

  it('should lowercase all tokens', () => {
    const rows = [['ALICE SMITH', 'F']];
    const blocked = buildBlockedTokens(rows, 0);

    expect(blocked.has('alice')).toBe(true);
    expect(blocked.has('smith')).toBe(true);
    // Original casing should NOT be in the set
    expect(blocked.has('ALICE')).toBe(false);
  });

  it('should handle string flags as well as object flags', () => {
    const rows = [['Alice Smith', 'F']];
    const flags = ['Epilepsy', 'Asthma'];
    const blocked = buildBlockedTokens(rows, 0, flags);

    expect(blocked.has('epilepsy')).toBe(true);
    expect(blocked.has('asthma')).toBe(true);
  });
});
