import { describe, it, expect } from 'vitest';
import { scanText } from '../src/scanner.js';

describe('scanText', () => {
  // ── Name matching ──────────────────────────────────────────────

  describe('name matching', () => {
    const knownNames = ['James Chen', 'Emily Barker', 'Aisha Patel'];

    it('catches full names from class list', () => {
      const result = scanText('The student James Chen scored highly.', { knownNames });
      const nameFlags = result.flags.filter(f => f.type === 'name');
      const values = nameFlags.map(f => f.value);
      expect(values).toContain('James Chen');
    });

    it('catches first-name-only matches', () => {
      const result = scanText('Emily did well on the test.', { knownNames });
      const nameFlags = result.flags.filter(f => f.type === 'name');
      const values = nameFlags.map(f => f.value);
      expect(values).toContain('Emily');
    });

    it('catches surname-only matches', () => {
      const result = scanText('Barker needs additional support.', { knownNames });
      const nameFlags = result.flags.filter(f => f.type === 'name');
      const values = nameFlags.map(f => f.value);
      expect(values).toContain('Barker');
    });

    it('is case-insensitive', () => {
      const result = scanText('JAMES CHEN and emily barker were present.', { knownNames });
      const nameFlags = result.flags.filter(f => f.type === 'name');
      expect(nameFlags.length).toBeGreaterThanOrEqual(2);
      // Should find both names regardless of case
      const lowerValues = nameFlags.map(f => f.value.toLowerCase());
      expect(lowerValues).toContain('james chen');
      expect(lowerValues).toContain('emily barker');
    });

    it('does not match partial words', () => {
      // "Jamestown" should not trigger a match for "James"
      const result = scanText('Jamesworth is a nice place.', { knownNames });
      const nameFlags = result.flags.filter(f => f.type === 'name');
      expect(nameFlags.length).toBe(0);
    });

    it('detects staff names', () => {
      const result = scanText('Mrs Thompson gave the assignment.', {
        knownNames: [],
        staffNames: ['Sarah Thompson'],
      });
      const nameFlags = result.flags.filter(f => f.type === 'name');
      const values = nameFlags.map(f => f.value);
      expect(values).toContain('Thompson');
    });

    it('matches full name before parts to avoid duplicate flags at same position', () => {
      const result = scanText('James Chen is a student.', { knownNames });
      const nameFlags = result.flags.filter(f => f.type === 'name');
      // Should have the full name match; individual parts should not duplicate the same range
      const fullMatch = nameFlags.find(f => f.value === 'James Chen');
      expect(fullMatch).toBeDefined();
    });
  });

  // ── Keyword matching ───────────────────────────────────────────

  describe('keyword matching', () => {
    it('catches medical keywords', () => {
      const result = scanText('Student has epilepsy and ADHD. Also diagnosed with dyslexia.', {});
      const kwFlags = result.flags.filter(f => f.type === 'keyword' && f.subtype === 'medical');
      const values = kwFlags.map(f => f.value.toLowerCase());
      expect(values).toContain('epilepsy');
      expect(values).toContain('adhd');
      expect(values).toContain('dyslexia');
    });

    it('catches safeguarding keywords', () => {
      const result = scanText('Referred to social services for child protection concerns.', {});
      const kwFlags = result.flags.filter(f => f.type === 'keyword' && f.subtype === 'safeguarding');
      const values = kwFlags.map(f => f.value.toLowerCase());
      expect(values).toContain('social services');
      expect(values).toContain('child protection');
    });

    it('catches family keywords', () => {
      const result = scanText('His mother and father attended the meeting. His brother is in Year 9, and his sister in Year 7.', {});
      const kwFlags = result.flags.filter(f => f.type === 'keyword' && f.subtype === 'family');
      const values = kwFlags.map(f => f.value.toLowerCase());
      expect(values).toContain('mother');
      expect(values).toContain('father');
      expect(values).toContain('brother');
      expect(values).toContain('sister');
    });

    it('matches multi-word keywords as phrases', () => {
      const result = scanText('The occupational therapy sessions are helpful.', {});
      const kwFlags = result.flags.filter(f => f.type === 'keyword');
      const values = kwFlags.map(f => f.value.toLowerCase());
      expect(values).toContain('occupational therapy');
    });

    it('is case-insensitive for keywords', () => {
      const result = scanText('The student has been diagnosed with EPILEPSY.', {});
      const kwFlags = result.flags.filter(f => f.type === 'keyword' && f.subtype === 'medical');
      expect(kwFlags.length).toBeGreaterThanOrEqual(1);
    });

    it('supports custom keyword lists', () => {
      const customKeywords = {
        medical: ['custom condition'],
        safeguarding: [],
        family: [],
      };
      const result = scanText('This student has a custom condition.', { keywords: customKeywords });
      const kwFlags = result.flags.filter(f => f.type === 'keyword');
      expect(kwFlags.map(f => f.value.toLowerCase())).toContain('custom condition');
    });
  });

  // ── Date patterns ──────────────────────────────────────────────

  describe('date patterns', () => {
    it('catches dd/mm/yyyy format', () => {
      const result = scanText('Born on 12/03/2024 in London.', {});
      const dateFlags = result.flags.filter(f => f.type === 'date');
      expect(dateFlags.map(f => f.value)).toContain('12/03/2024');
    });

    it('catches d/m/yy short format', () => {
      const result = scanText('Meeting on 5/6/23 was productive.', {});
      const dateFlags = result.flags.filter(f => f.type === 'date');
      expect(dateFlags.map(f => f.value)).toContain('5/6/23');
    });

    it('catches dd-mm-yyyy format', () => {
      const result = scanText('Date: 01-02-2025 confirmed.', {});
      const dateFlags = result.flags.filter(f => f.type === 'date');
      expect(dateFlags.map(f => f.value)).toContain('01-02-2025');
    });

    it('catches dd.mm.yyyy format', () => {
      const result = scanText('Enrolled 15.09.2023 at school.', {});
      const dateFlags = result.flags.filter(f => f.type === 'date');
      expect(dateFlags.map(f => f.value)).toContain('15.09.2023');
    });
  });

  // ── Postcode patterns ──────────────────────────────────────────

  describe('postcode patterns', () => {
    it('catches SW1A 1AA format', () => {
      const result = scanText('Address is SW1A 1AA, London.', {});
      const pcFlags = result.flags.filter(f => f.type === 'postcode');
      expect(pcFlags.map(f => f.value)).toContain('SW1A 1AA');
    });

    it('catches M1 1AA format', () => {
      const result = scanText('Located at M1 1AA Manchester.', {});
      const pcFlags = result.flags.filter(f => f.type === 'postcode');
      expect(pcFlags.map(f => f.value)).toContain('M1 1AA');
    });

    it('catches EC1A 1BB format', () => {
      const result = scanText('Office at EC1A 1BB in the city.', {});
      const pcFlags = result.flags.filter(f => f.type === 'postcode');
      expect(pcFlags.map(f => f.value)).toContain('EC1A 1BB');
    });

    it('catches postcodes without spaces', () => {
      const result = scanText('Postcode: SW1A1AA recorded.', {});
      const pcFlags = result.flags.filter(f => f.type === 'postcode');
      expect(pcFlags.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Phone patterns ────────────────────────────────────────────

  describe('phone patterns', () => {
    it('catches UK mobile numbers', () => {
      const result = scanText('Call 07712345678 for info.', {});
      const phoneFlags = result.flags.filter(f => f.type === 'phone');
      expect(phoneFlags.length).toBeGreaterThanOrEqual(1);
      expect(phoneFlags[0].value).toContain('07712345678');
    });

    it('catches UK landline numbers', () => {
      const result = scanText('Office: 01234567890 during hours.', {});
      const phoneFlags = result.flags.filter(f => f.type === 'phone');
      expect(phoneFlags.length).toBeGreaterThanOrEqual(1);
    });

    it('catches international +44 format', () => {
      const result = scanText('International: +44 7712345678 available.', {});
      const phoneFlags = result.flags.filter(f => f.type === 'phone');
      expect(phoneFlags.length).toBeGreaterThanOrEqual(1);
      expect(phoneFlags[0].value).toContain('+44');
    });
  });

  // ── Email patterns ────────────────────────────────────────────

  describe('email patterns', () => {
    it('catches email addresses', () => {
      const result = scanText('Contact j.smith@school.org for details.', {});
      const emailFlags = result.flags.filter(f => f.type === 'email');
      expect(emailFlags.map(f => f.value)).toContain('j.smith@school.org');
    });

    it('catches complex email addresses', () => {
      const result = scanText('Send to first.last+tag@example.co.uk please.', {});
      const emailFlags = result.flags.filter(f => f.type === 'email');
      expect(emailFlags.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── False positive avoidance ───────────────────────────────────

  describe('false positive avoidance', () => {
    it('does not flag common words in benign text', () => {
      const text = 'The students completed their work on time and the results were excellent.';
      const result = scanText(text, { knownNames: [] });
      // Should not produce name flags for random benign text
      const nameFlags = result.flags.filter(f => f.type === 'name');
      expect(nameFlags.length).toBe(0);
    });

    it('does not flag names that are substrings of other words', () => {
      const result = scanText('The painting was beautiful.', {
        knownNames: ['Tim Pain'],
      });
      // "Pain" as a standalone word could match, but "painting" should not
      const nameFlags = result.flags.filter(f => f.type === 'name');
      const hasPartialMatch = nameFlags.some(f => f.value.toLowerCase() === 'painting');
      expect(hasPartialMatch).toBe(false);
    });
  });

  // ── Multiple flags in one string ──────────────────────────────

  describe('combined scanning', () => {
    it('finds multiple flag types in one text', () => {
      const text = 'James Chen (DOB: 12/03/2010) lives at SW1A 1AA. Contact: j.chen@school.org, 07712345678. Has epilepsy. Mother concerned.';
      const result = scanText(text, { knownNames: ['James Chen'] });

      const types = new Set(result.flags.map(f => f.type));
      expect(types.has('name')).toBe(true);
      expect(types.has('date')).toBe(true);
      expect(types.has('postcode')).toBe(true);
      expect(types.has('email')).toBe(true);
      expect(types.has('phone')).toBe(true);
      expect(types.has('keyword')).toBe(true);
    });

    it('returns flags sorted by position', () => {
      const text = 'Emily Barker has ADHD. Lives at M1 1AA.';
      const result = scanText(text, { knownNames: ['Emily Barker'] });

      for (let i = 1; i < result.flags.length; i++) {
        expect(result.flags[i].position).toBeGreaterThanOrEqual(result.flags[i - 1].position);
      }
    });
  });

  // ── Context extraction ─────────────────────────────────────────

  describe('context extraction', () => {
    it('includes surrounding text in context', () => {
      const text = 'The student James Chen scored 95 on the test.';
      const result = scanText(text, { knownNames: ['James Chen'] });
      const nameFlag = result.flags.find(f => f.type === 'name' && f.value === 'James Chen');
      expect(nameFlag).toBeDefined();
      expect(nameFlag.context).toContain('James Chen');
      // Context should include some surrounding text
      expect(nameFlag.context.length).toBeGreaterThan('James Chen'.length);
    });

    it('handles flags at the start of text', () => {
      const text = 'James Chen is a student.';
      const result = scanText(text, { knownNames: ['James Chen'] });
      const nameFlag = result.flags.find(f => f.type === 'name' && f.value === 'James Chen');
      expect(nameFlag).toBeDefined();
      expect(nameFlag.position).toBe(0);
      expect(nameFlag.context).toContain('James Chen');
    });

    it('handles flags at the end of text', () => {
      const text = 'Student is James Chen';
      const result = scanText(text, { knownNames: ['James Chen'] });
      const nameFlag = result.flags.find(f => f.type === 'name' && f.value === 'James Chen');
      expect(nameFlag).toBeDefined();
      expect(nameFlag.context).toContain('James Chen');
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns empty flags for empty text', () => {
      const result = scanText('', { knownNames: ['James Chen'] });
      expect(result.flags).toEqual([]);
    });

    it('returns empty flags for no config', () => {
      const result = scanText('Some benign text with no sensitive data.');
      expect(result.flags.filter(f => f.type === 'name').length).toBe(0);
    });

    it('handles extra patterns', () => {
      const result = scanText('Student ID: STU-12345 recorded.', {
        extraPatterns: [{ pattern: /STU-\d{5}/g, type: 'student-id' }],
      });
      const customFlags = result.flags.filter(f => f.type === 'student-id');
      expect(customFlags.length).toBe(1);
      expect(customFlags[0].value).toBe('STU-12345');
    });
  });
});
