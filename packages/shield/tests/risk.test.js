import { describe, it, expect } from 'vitest';
import { analyseRisk } from '../src/risk.js';

/**
 * Helper: generate rows where every row has the same quasi-identifier values.
 */
function makeUniformRows(n, qiValues, extraCols = []) {
  return Array.from({ length: n }, () => [...qiValues, ...extraCols]);
}

describe('analyseRisk', () => {
  // ----------------------------------------------------------------
  // k-threshold auto-selection
  // ----------------------------------------------------------------
  describe('k-threshold auto-selection', () => {
    it('uses k=3 for 22-student dataset (>=20)', () => {
      const data = makeUniformRows(22, ['F', 'No']);
      const result = analyseRisk(data, { quasiIdentifiers: [0, 1] });
      expect(result.kAnonymity.threshold).toBe(3);
    });

    it('uses k=5 for 10-student dataset (<20)', () => {
      const data = makeUniformRows(10, ['M', 'No']);
      const result = analyseRisk(data, { quasiIdentifiers: [0, 1] });
      expect(result.kAnonymity.threshold).toBe(5);
    });

    it('uses k=3 for exactly 20 students (>=20)', () => {
      const data = makeUniformRows(20, ['F', 'No']);
      const result = analyseRisk(data, { quasiIdentifiers: [0, 1] });
      expect(result.kAnonymity.threshold).toBe(3);
    });

    it('uses k=5 for 19 students (<20)', () => {
      const data = makeUniformRows(19, ['F', 'No']);
      const result = analyseRisk(data, { quasiIdentifiers: [0, 1] });
      expect(result.kAnonymity.threshold).toBe(5);
    });

    it('respects a fixed kThreshold', () => {
      const data = makeUniformRows(22, ['F', 'No']);
      const result = analyseRisk(data, { quasiIdentifiers: [0, 1], kThreshold: 7 });
      expect(result.kAnonymity.threshold).toBe(7);
    });
  });

  // ----------------------------------------------------------------
  // k-anonymity grouping
  // ----------------------------------------------------------------
  describe('k-anonymity grouping', () => {
    it('flags no groups when all rows are identical', () => {
      const data = makeUniformRows(22, ['F', 'No', 'No']);
      const result = analyseRisk(data, { quasiIdentifiers: [0, 1, 2] });
      expect(result.kAnonymity.flaggedGroups).toHaveLength(0);
      expect(result.kAnonymity.safeStudents).toBe(22);
    });

    it('flags a unique combination correctly', () => {
      // 21 identical rows + 1 unique row → k=3 → unique row is flagged.
      const data = [
        ...makeUniformRows(21, ['F', 'No']),
        ['M', 'EHCP'],
      ];
      const result = analyseRisk(data, { quasiIdentifiers: [0, 1] });
      expect(result.kAnonymity.flaggedGroups).toHaveLength(1);
      expect(result.kAnonymity.flaggedGroups[0].count).toBe(1);
      expect(result.kAnonymity.flaggedGroups[0].rowIndices).toEqual([21]);
      expect(result.kAnonymity.safeStudents).toBe(21);
    });

    it('correctly groups known dataset with known counts', () => {
      // 10 F/No, 8 M/No, 3 F/Yes, 1 M/Yes → total 22, k=3
      const data = [
        ...makeUniformRows(10, ['F', 'No']),
        ...makeUniformRows(8, ['M', 'No']),
        ...makeUniformRows(3, ['F', 'Yes']),
        ...makeUniformRows(1, ['M', 'Yes']),
      ];
      const result = analyseRisk(data, { quasiIdentifiers: [0, 1] });
      // Only M/Yes (count 1) is flagged (< 3)
      expect(result.kAnonymity.flaggedGroups).toHaveLength(1);
      expect(result.kAnonymity.flaggedGroups[0].count).toBe(1);
      expect(result.kAnonymity.safeStudents).toBe(21);
      expect(result.kAnonymity.totalStudents).toBe(22);
    });

    it('flags multiple small groups', () => {
      // 16 F/No, 2 M/Yes, 2 F/EHCP, 2 M/No → total 22, k=3
      const data = [
        ...makeUniformRows(16, ['F', 'No']),
        ...makeUniformRows(2, ['M', 'Yes']),
        ...makeUniformRows(2, ['F', 'EHCP']),
        ...makeUniformRows(2, ['M', 'No']),
      ];
      const result = analyseRisk(data, { quasiIdentifiers: [0, 1] });
      // Three groups of 2 are all < 3
      expect(result.kAnonymity.flaggedGroups).toHaveLength(3);
      expect(result.kAnonymity.safeStudents).toBe(16);
    });

    it('works with single column quasi-identifier', () => {
      const data = [
        ...makeUniformRows(19, ['F']),
        ...makeUniformRows(1, ['M']),
      ];
      // 20 total → k=3, M group has count 1 → flagged
      const result = analyseRisk(data, { quasiIdentifiers: [0] });
      expect(result.kAnonymity.threshold).toBe(3);
      expect(result.kAnonymity.flaggedGroups).toHaveLength(1);
      expect(result.kAnonymity.flaggedGroups[0].count).toBe(1);
    });

    it('reports correct rowIndices for flagged groups', () => {
      // Rows 0-4: group A (5), rows 5-6: group B (2) → k=3 (7 < 20 → k=5)
      // With k=5, group A is safe (5), group B is flagged (2)
      const data = [
        ...makeUniformRows(5, ['A']),
        ...makeUniformRows(2, ['B']),
      ];
      const result = analyseRisk(data, { quasiIdentifiers: [0] });
      expect(result.kAnonymity.threshold).toBe(5);
      expect(result.kAnonymity.flaggedGroups).toHaveLength(1);
      expect(result.kAnonymity.flaggedGroups[0].rowIndices).toEqual([5, 6]);
    });
  });

  // ----------------------------------------------------------------
  // Rare-category detection
  // ----------------------------------------------------------------
  describe('rare-category detection', () => {
    it('flags EHCP among 20 No SEN values', () => {
      const data = [
        ...Array.from({ length: 20 }, () => ['F', 'No SEN']),
        ['F', 'EHCP'],
      ];
      const result = analyseRisk(data, {
        quasiIdentifiers: [0],
        categoricalColumns: [{ index: 1, name: 'SEN' }],
      });
      expect(result.rareCategories).toHaveLength(1);
      expect(result.rareCategories[0].value).toBe('EHCP');
      expect(result.rareCategories[0].count).toBe(1);
    });

    it('does not flag when all values have 5+ occurrences', () => {
      const data = [
        ...Array.from({ length: 10 }, () => ['F', 'No']),
        ...Array.from({ length: 10 }, () => ['F', 'Yes']),
      ];
      const result = analyseRisk(data, {
        quasiIdentifiers: [0],
        categoricalColumns: [{ index: 1, name: 'PP' }],
      });
      expect(result.rareCategories).toHaveLength(0);
    });

    it('does not flag when each value has exactly 3 occurrences (threshold = min(3, k=3))', () => {
      const data = [
        ...Array.from({ length: 3 }, () => ['A']),
        ...Array.from({ length: 3 }, () => ['B']),
        ...Array.from({ length: 3 }, () => ['C']),
        ...Array.from({ length: 3 }, () => ['D']),
        ...Array.from({ length: 3 }, () => ['E']),
        ...Array.from({ length: 3 }, () => ['F']),
        ...Array.from({ length: 3 }, () => ['G']),
      ];
      // 21 rows → k=3, rareThreshold = min(3, 3) = 3 → count of 3 is NOT < 3
      const result = analyseRisk(data, {
        quasiIdentifiers: [],
        categoricalColumns: [{ index: 0, name: 'Group' }],
      });
      expect(result.rareCategories).toHaveLength(0);
    });

    it('flags values with count 2 when threshold is 3', () => {
      const data = [
        ...Array.from({ length: 20 }, () => ['No']),
        ...Array.from({ length: 2 }, () => ['Yes']),
      ];
      // 22 rows → k=3, threshold = min(3, 3) = 3 → count 2 < 3 → flagged
      const result = analyseRisk(data, {
        quasiIdentifiers: [],
        categoricalColumns: [{ index: 0, name: 'PP' }],
      });
      expect(result.rareCategories).toHaveLength(1);
      expect(result.rareCategories[0].count).toBe(2);
    });

    it('returns correct generalisation suggestion from generalisations.json', () => {
      const data = [
        ...Array.from({ length: 20 }, () => ['No SEN']),
        ['EHCP'],
      ];
      const result = analyseRisk(data, {
        quasiIdentifiers: [],
        categoricalColumns: [{ index: 0, name: 'SEN' }],
      });
      expect(result.rareCategories).toHaveLength(1);
      expect(result.rareCategories[0].suggestion).toBe('SEN: Yes');
    });

    it('returns null suggestion when no generalisation exists', () => {
      const data = [
        ...Array.from({ length: 20 }, () => ['Normal']),
        ['UnknownRareValue'],
      ];
      const result = analyseRisk(data, {
        quasiIdentifiers: [],
        categoricalColumns: [{ index: 0, name: 'UnknownCategory' }],
      });
      expect(result.rareCategories).toHaveLength(1);
      expect(result.rareCategories[0].suggestion).toBeNull();
    });

    it('looks up generalisation for PP column', () => {
      const data = [
        ...Array.from({ length: 20 }, () => ['No']),
        ['FSM'],
      ];
      const result = analyseRisk(data, {
        quasiIdentifiers: [],
        categoricalColumns: [{ index: 0, name: 'PP' }],
      });
      expect(result.rareCategories[0].value).toBe('FSM');
      expect(result.rareCategories[0].suggestion).toBe('Disadvantaged: Yes');
    });
  });

  // ----------------------------------------------------------------
  // Recommendations
  // ----------------------------------------------------------------
  describe('recommendations', () => {
    it('returns plain-English strings', () => {
      const data = [
        ...makeUniformRows(21, ['F', 'No']),
        ['M', 'EHCP'],
      ];
      const result = analyseRisk(data, {
        quasiIdentifiers: [0, 1],
        categoricalColumns: [{ index: 1, name: 'SEN' }],
      });
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThan(0);
      for (const rec of result.recommendations) {
        expect(typeof rec).toBe('string');
      }
    });

    it('includes summary with safe/total counts', () => {
      const data = [
        ...makeUniformRows(21, ['F', 'No']),
        ['M', 'EHCP'],
      ];
      const result = analyseRisk(data, { quasiIdentifiers: [0, 1] });
      const summary = result.recommendations[0];
      expect(summary).toContain('21');
      expect(summary).toContain('22');
    });

    it('reports no risk when all groups are safe', () => {
      const data = makeUniformRows(22, ['F', 'No']);
      const result = analyseRisk(data, { quasiIdentifiers: [0, 1] });
      expect(result.recommendations[0]).toContain('No re-identification risk');
    });

    it('includes per-group detail for flagged groups', () => {
      const data = [
        ...makeUniformRows(20, ['F', 'No']),
        ['M', 'Yes'],
        ['M', 'EHCP'],
      ];
      const result = analyseRisk(data, { quasiIdentifiers: [0, 1] });
      // Should have a recommendation line for each flagged group
      const groupRecs = result.recommendations.filter((r) => r.startsWith('Group'));
      expect(groupRecs.length).toBeGreaterThan(0);
    });

    it('includes rare category suggestions in recommendations', () => {
      const data = [
        ...Array.from({ length: 20 }, () => ['F', 'No SEN']),
        ['F', 'EHCP'],
      ];
      const result = analyseRisk(data, {
        quasiIdentifiers: [0],
        categoricalColumns: [{ index: 1, name: 'SEN' }],
      });
      const rareRec = result.recommendations.find((r) => r.includes('EHCP'));
      expect(rareRec).toBeDefined();
      expect(rareRec).toContain('SEN: Yes');
    });
  });

  // ----------------------------------------------------------------
  // Edge cases
  // ----------------------------------------------------------------
  describe('edge cases', () => {
    it('handles empty dataset', () => {
      const result = analyseRisk([], { quasiIdentifiers: [0, 1] });
      expect(result.kAnonymity.totalStudents).toBe(0);
      expect(result.kAnonymity.safeStudents).toBe(0);
      expect(result.kAnonymity.flaggedGroups).toHaveLength(0);
      expect(result.rareCategories).toHaveLength(0);
      expect(result.recommendations).toContain('No data to analyse.');
    });

    it('handles empty quasiIdentifiers', () => {
      const data = makeUniformRows(5, ['A', 'B']);
      const result = analyseRisk(data, { quasiIdentifiers: [] });
      expect(result.kAnonymity.flaggedGroups).toHaveLength(0);
      expect(result.kAnonymity.safeStudents).toBe(5);
    });

    it('handles missing config gracefully', () => {
      const data = makeUniformRows(5, ['A']);
      const result = analyseRisk(data, {});
      expect(result.kAnonymity).toBeDefined();
      expect(result.rareCategories).toEqual([]);
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('handles null/undefined values in data', () => {
      const data = [
        ['F', null],
        ['F', null],
        ['F', null],
        ['F', undefined],
        ['M', 'Yes'],
      ];
      const result = analyseRisk(data, { quasiIdentifiers: [0, 1] });
      // Should not throw; null and undefined are stringified consistently
      expect(result.kAnonymity.totalStudents).toBe(5);
    });

    it('returns correct structure shape', () => {
      const data = makeUniformRows(10, ['F', 'No']);
      const result = analyseRisk(data, { quasiIdentifiers: [0, 1] });
      expect(result).toHaveProperty('kAnonymity');
      expect(result).toHaveProperty('rareCategories');
      expect(result).toHaveProperty('recommendations');
      expect(result.kAnonymity).toHaveProperty('threshold');
      expect(result.kAnonymity).toHaveProperty('totalStudents');
      expect(result.kAnonymity).toHaveProperty('safeStudents');
      expect(result.kAnonymity).toHaveProperty('flaggedGroups');
    });
  });
});
