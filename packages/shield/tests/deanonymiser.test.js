import { describe, it, expect } from 'vitest';
import { deanonymise } from '../src/deanonymiser.js';

const mapping = {
  ids: { 'S01': 'James Chen', 'S02': 'Emily Barker', 'S03': 'Aisha Rahman' },
  names: { 'Alex Carter': 'James Chen', 'Priya Okonkwo': 'Emily Barker', 'Ryan Mitchell': 'Aisha Rahman' },
  nameToId: { 'Alex Carter': 'S01', 'Priya Okonkwo': 'S02', 'Ryan Mitchell': 'S03' },
  idToFake: { 'S01': 'Alex Carter', 'S02': 'Priya Okonkwo', 'S03': 'Ryan Mitchell' }
};

describe('deanonymiser', () => {

  describe('id-first strategy (default)', () => {

    it('replaces "FakeName [SXX]" combined pattern with real name', () => {
      const result = deanonymise('Alex Carter [S01] scored well', mapping);
      expect(result.text).toBe('James Chen scored well');
      expect(result.stats.idMatches).toBe(1);
    });

    it('replaces standalone [SXX] with real name', () => {
      const result = deanonymise('[S01] scored well', mapping);
      expect(result.text).toBe('James Chen scored well');
      expect(result.stats.idMatches).toBe(1);
    });

    it('replaces fake name without ID via global pass', () => {
      const result = deanonymise('Alex Carter scored well', mapping);
      expect(result.text).toBe('James Chen scored well');
      expect(result.stats.nameMatches).toBeGreaterThanOrEqual(1);
    });

    it('replaces multiple students in one text', () => {
      const text = 'Alex Carter [S01] and Priya Okonkwo [S02] both improved.';
      const result = deanonymise(text, mapping);
      expect(result.text).toBe('James Chen and Emily Barker both improved.');
      expect(result.stats.idMatches).toBe(2);
    });

    it('handles IDs and bare names mixed together', () => {
      const text = '[S01] did better than Ryan Mitchell this term.';
      const result = deanonymise(text, mapping);
      expect(result.text).toBe('James Chen did better than Aisha Rahman this term.');
    });

    it('returns empty unmatched when all names replaced', () => {
      const text = 'Alex Carter [S01] is great.';
      const result = deanonymise(text, mapping);
      expect(result.unmatched).toEqual([]);
    });

  });

  describe('curly quotes and unicode', () => {

    it('handles curly double quotes around fake names', () => {
      // \u201C = left double quote, \u201D = right double quote
      const text = '\u201CAlex Carter\u201D performed well';
      const result = deanonymise(text, mapping);
      expect(result.text).toBe('\u201CJames Chen\u201D performed well');
    });

    it('handles curly single quotes around fake names', () => {
      const text = '\u2018Alex Carter\u2019 performed well';
      const result = deanonymise(text, mapping);
      expect(result.text).toBe('\u2018James Chen\u2019 performed well');
    });

  });

  describe('possessives', () => {

    it('replaces fake name with ASCII possessive', () => {
      const text = "Alex Carter's work was excellent";
      const result = deanonymise(text, mapping);
      expect(result.text).toBe("James Chen's work was excellent");
    });

    it('replaces fake name with curly possessive', () => {
      const text = 'Alex Carter\u2019s work was excellent';
      const result = deanonymise(text, mapping);
      expect(result.text).toBe('James Chen\u2019s work was excellent');
    });

  });

  describe('all-caps', () => {

    it('replaces ALL-CAPS fake name with canonical-case real name', () => {
      const text = 'ALEX CARTER scored 85%';
      const result = deanonymise(text, mapping);
      expect(result.text).toBe('James Chen scored 85%');
    });

  });

  describe('longest-name-first ordering', () => {

    it('does not partially replace when names share substrings', () => {
      // Create a mapping with overlapping names
      const overlapMapping = {
        ids: { 'S01': 'James Chen' },
        names: {
          'Alex James Carter': 'Full Real Name',
          'Alex James': 'Short Real Name',
        },
        nameToId: {},
        idToFake: {}
      };
      const text = 'Alex James Carter did well';
      const result = deanonymise(text, overlapMapping);
      expect(result.text).toBe('Full Real Name did well');
    });

  });

  describe('table detection', () => {

    it('replaces fake names in markdown table Student column', () => {
      const text = [
        '| Student | Score | Grade |',
        '|---------|-------|-------|',
        '| Alex Carter | 85 | A |',
        '| Priya Okonkwo | 72 | B |',
        '| Ryan Mitchell | 65 | C |',
      ].join('\n');

      const result = deanonymise(text, mapping);
      expect(result.text).toContain('James Chen');
      expect(result.text).toContain('Emily Barker');
      expect(result.text).toContain('Aisha Rahman');
      expect(result.text).not.toContain('Alex Carter');
      expect(result.text).not.toContain('Priya Okonkwo');
      expect(result.text).not.toContain('Ryan Mitchell');
    });

    it('replaces names in table with Name column header', () => {
      const text = [
        '| Name | Attendance |',
        '|------|------------|',
        '| Alex Carter | 95% |',
      ].join('\n');

      const result = deanonymise(text, mapping);
      expect(result.text).toContain('James Chen');
    });

  });

  describe('STUDENT: prefix', () => {

    it('replaces fake name after STUDENT: prefix', () => {
      const text = 'STUDENT: Alex Carter';
      const result = deanonymise(text, mapping);
      expect(result.text).toBe('STUDENT: James Chen');
    });

    it('replaces fake name after Student: prefix', () => {
      const text = 'Student: Priya Okonkwo';
      const result = deanonymise(text, mapping);
      expect(result.text).toBe('Student: Emily Barker');
    });

  });

  describe('json strategy', () => {

    it('parses valid JSON and replaces IDs and names', () => {
      const jsonText = JSON.stringify({
        students: [
          { name: 'Alex Carter', id: '[S01]', score: 85 },
          { name: 'Priya Okonkwo', id: '[S02]', score: 72 },
        ]
      });

      const result = deanonymise(jsonText, mapping, { strategy: 'json' });
      expect(result.valid).toBe(true);
      expect(result.parsed.students[0].name).toBe('James Chen');
      expect(result.parsed.students[0].id).toBe('James Chen');
      expect(result.parsed.students[1].name).toBe('Emily Barker');
    });

    it('falls back to id-first on invalid JSON', () => {
      const text = 'This is not JSON. Alex Carter [S01] scored well.';
      const result = deanonymise(text, mapping, { strategy: 'json' });
      expect(result.valid).toBe(false);
      expect(result.text).toBe('This is not JSON. James Chen scored well.');
    });

  });

  describe('structured-only strategy', () => {

    it('does NOT replace fake names in plain prose', () => {
      const text = 'Alex Carter did well in the exam. STUDENT: Priya Okonkwo';
      const result = deanonymise(text, mapping, { strategy: 'structured-only' });
      // Prose name should NOT be replaced
      expect(result.text).toContain('Alex Carter did well');
      // Structured prefix SHOULD be replaced
      expect(result.text).toContain('STUDENT: Emily Barker');
      // Alex Carter should be in unmatched
      expect(result.unmatched).toContain('Alex Carter');
    });

    it('replaces IDs even in prose', () => {
      const text = '[S01] scored 85%.';
      const result = deanonymise(text, mapping, { strategy: 'structured-only' });
      expect(result.text).toBe('James Chen scored 85%.');
      expect(result.stats.idMatches).toBe(1);
    });

  });

  describe('global strategy', () => {

    it('replaces all fake names regardless of structure', () => {
      const text = 'Alex Carter and Priya Okonkwo both did well.';
      const result = deanonymise(text, mapping, { strategy: 'global' });
      expect(result.text).toBe('James Chen and Emily Barker both did well.');
    });

    it('also replaces IDs', () => {
      const text = '[S03] was absent.';
      const result = deanonymise(text, mapping, { strategy: 'global' });
      expect(result.text).toBe('Aisha Rahman was absent.');
    });

  });

  describe('stats accuracy', () => {

    it('counts ID matches correctly', () => {
      const text = '[S01] and [S02] and [S03]';
      const result = deanonymise(text, mapping);
      expect(result.stats.idMatches).toBe(3);
    });

    it('counts name matches in global pass', () => {
      const text = 'Alex Carter was here. Then Alex Carter again.';
      const result = deanonymise(text, mapping);
      expect(result.stats.nameMatches).toBe(2);
    });

    it('reports unmatched names when strategy cannot reach them', () => {
      const text = 'Ryan Mitchell was in class.';
      const result = deanonymise(text, mapping, { strategy: 'structured-only' });
      expect(result.unmatched).toContain('Ryan Mitchell');
    });

  });

  describe('round-trip test', () => {

    it('restores all real names from anonymised text', () => {
      const anonymisedText = [
        'Analysis of Year 10 English:',
        '',
        'Alex Carter [S01] achieved a score of 85%, showing strong progress.',
        'Priya Okonkwo [S02] scored 72% and needs support in reading comprehension.',
        'Ryan Mitchell [S03] had 65% and should focus on essay structure.',
        '',
        '| Student | Score |',
        '|---------|-------|',
        '| Alex Carter | 85 |',
        '| Priya Okonkwo | 72 |',
        '| Ryan Mitchell | 65 |',
      ].join('\n');

      const result = deanonymise(anonymisedText, mapping);

      expect(result.text).not.toContain('Alex Carter');
      expect(result.text).not.toContain('Priya Okonkwo');
      expect(result.text).not.toContain('Ryan Mitchell');
      expect(result.text).toContain('James Chen');
      expect(result.text).toContain('Emily Barker');
      expect(result.text).toContain('Aisha Rahman');
      expect(result.unmatched).toEqual([]);
    });

  });

  describe('mixed AI output (ChatGPT-style)', () => {

    it('handles realistic multi-format AI output', () => {
      const aiOutput = [
        '## Year 10 English Analysis',
        '',
        'Here is my analysis of the class performance:',
        '',
        '### Summary Table',
        '',
        '| Student | Score | Grade | Comment |',
        '|---------|-------|-------|---------|',
        '| Alex Carter | 85 | A | Excellent |',
        '| Priya Okonkwo | 72 | B | Good progress |',
        '| Ryan Mitchell | 65 | C | Needs support |',
        '',
        '### Individual Feedback',
        '',
        '**Alex Carter [S01]:** Alex Carter has shown excellent progress this term. ',
        "Alex Carter's essay writing is particularly strong.",
        '',
        '**Priya Okonkwo [S02]:** Priya Okonkwo needs to focus on reading ',
        'comprehension. However, Priya Okonkwo\u2019s creative writing has improved.',
        '',
        '**Ryan Mitchell [S03]:** Ryan Mitchell should work on essay structure. ',
        'Overall, Ryan Mitchell has potential for improvement.',
        '',
        '### Recommendations',
        '',
        '- Alex Carter: Continue with current approach',
        '- Priya Okonkwo: Additional reading support needed',
        '- Ryan Mitchell: Focus on essay planning',
      ].join('\n');

      const result = deanonymise(aiOutput, mapping);

      // No fake names should remain
      expect(result.text).not.toContain('Alex Carter');
      expect(result.text).not.toContain('Priya Okonkwo');
      expect(result.text).not.toContain('Ryan Mitchell');

      // All real names should be present
      expect(result.text).toContain('James Chen');
      expect(result.text).toContain('Emily Barker');
      expect(result.text).toContain('Aisha Rahman');

      // Possessives should be preserved
      expect(result.text).toContain("James Chen's essay writing");
      expect(result.text).toContain('Emily Barker\u2019s creative writing');

      expect(result.unmatched).toEqual([]);
      expect(result.stats.idMatches).toBe(3);
      expect(result.stats.nameMatches).toBeGreaterThan(0);
    });

  });

  describe('edge cases', () => {

    it('returns unchanged text when mapping is empty', () => {
      const emptyMapping = { ids: {}, names: {}, nameToId: {}, idToFake: {} };
      const text = 'Hello world';
      const result = deanonymise(text, emptyMapping);
      expect(result.text).toBe('Hello world');
      expect(result.stats.idMatches).toBe(0);
      expect(result.stats.nameMatches).toBe(0);
    });

    it('handles unknown IDs gracefully', () => {
      const text = '[S99] was absent.';
      const result = deanonymise(text, mapping);
      expect(result.text).toBe('[S99] was absent.');
    });

    it('throws on unknown strategy', () => {
      expect(() => deanonymise('test', mapping, { strategy: 'unknown' }))
        .toThrow('Unknown de-anonymisation strategy: unknown');
    });

    it('handles empty text', () => {
      const result = deanonymise('', mapping);
      expect(result.text).toBe('');
    });

    it('handles text with trailing punctuation after names', () => {
      const text = 'Well done, Alex Carter!';
      const result = deanonymise(text, mapping);
      expect(result.text).toBe('Well done, James Chen!');
    });

    it('handles names at start and end of text', () => {
      const text = 'Alex Carter is here and so is Ryan Mitchell';
      const result = deanonymise(text, mapping);
      expect(result.text).toBe('James Chen is here and so is Aisha Rahman');
    });

    it('handles names in parentheses', () => {
      const text = '(Alex Carter) scored well';
      const result = deanonymise(text, mapping);
      expect(result.text).toBe('(James Chen) scored well');
    });

  });

});
