import { describe, it, expect } from 'vitest';
import names from '../src/data/names.json' with { type: 'json' };
import keywords from '../src/data/keywords.json' with { type: 'json' };
import generalisations from '../src/data/generalisations.json' with { type: 'json' };

describe('names.json', () => {
  it('has the expected structure', () => {
    expect(Array.isArray(names.male)).toBe(true);
    expect(Array.isArray(names.female)).toBe(true);
    expect(Array.isArray(names.neutral)).toBe(true);
    expect(Array.isArray(names.surnames)).toBe(true);
  });

  it('has approximately correct counts', () => {
    expect(names.male.length).toBeGreaterThanOrEqual(240);
    expect(names.male.length).toBeLessThanOrEqual(260);
    expect(names.female.length).toBeGreaterThanOrEqual(240);
    expect(names.female.length).toBeLessThanOrEqual(260);
    expect(names.neutral.length).toBeGreaterThanOrEqual(45);
    expect(names.neutral.length).toBeLessThanOrEqual(55);
    expect(names.surnames.length).toBeGreaterThanOrEqual(490);
    expect(names.surnames.length).toBeLessThanOrEqual(510);
  });

  it('has no duplicates within first name arrays', () => {
    for (const key of ['male', 'female', 'neutral']) {
      const set = new Set(names[key]);
      expect(set.size, `duplicates in ${key}`).toBe(names[key].length);
    }
  });

  it('has no cross-array first name duplicates', () => {
    const all = [...names.male, ...names.female, ...names.neutral];
    const set = new Set(all);
    expect(set.size).toBe(all.length);
  });

  it('has no duplicate surnames', () => {
    const set = new Set(names.surnames);
    expect(set.size).toBe(names.surnames.length);
  });

  it('has no common English words as surnames', () => {
    const banned = new Set([
      'Green', 'Brown', 'White', 'Black', 'Young', 'Long', 'Short', 'Rich',
      'Poor', 'Cook', 'King', 'Bell', 'Fox', 'Bird', 'Lamb', 'Fish', 'Stone',
      'Wood', 'Hill', 'Rose', 'Cross', 'Church', 'Park', 'Lane', 'Field',
      'Wall', 'Spring', 'Summer', 'Winter', 'Day', 'May', 'March', 'Page',
      'Knight', 'Grant', 'Wells', 'Banks', 'Marsh', 'Barber', 'Mason', 'Hunt',
      'Price', 'Bond', 'Cash', 'Hope', 'Love', 'Strong', 'Best', 'Little',
      'Small', 'Large', 'Bright', 'Sharp', 'Sweet', 'Swift', 'Wild', 'Grey',
      'Frost', 'Snow', 'Bush', 'Flower', 'Bloom', 'Crane', 'Dove', 'Wren',
      'Bear', 'Wolf', 'Diamond', 'Silver', 'Gold', 'Steel', 'Rock', 'Brick',
      'Glass', 'Pool', 'Lake', 'Brook', 'Reed', 'Dale', 'Glen', 'Vale',
      'Grove', 'Mead', 'Heath', 'Ash', 'Oak', 'Elm', 'Pine', 'Bay', 'Shore',
    ]);
    const badSurnames = names.surnames.filter((s) => banned.has(s));
    expect(badSurnames, 'Common English words found as surnames').toEqual([]);
  });

  it('all names are non-empty strings', () => {
    const all = [...names.male, ...names.female, ...names.neutral, ...names.surnames];
    for (const name of all) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });
});

describe('keywords.json', () => {
  it('has the expected categories', () => {
    expect(keywords).toHaveProperty('medical');
    expect(keywords).toHaveProperty('safeguarding');
    expect(keywords).toHaveProperty('family');
  });

  it('all categories are non-empty arrays of strings', () => {
    for (const [key, arr] of Object.entries(keywords)) {
      expect(Array.isArray(arr), `${key} is array`).toBe(true);
      expect(arr.length, `${key} is non-empty`).toBeGreaterThan(0);
      for (const item of arr) {
        expect(typeof item, `${key} contains strings`).toBe('string');
      }
    }
  });

  it('contains expected medical terms', () => {
    const med = keywords.medical.map((t) => t.toLowerCase());
    expect(med).toContain('adhd');
    expect(med).toContain('autism');
    expect(med).toContain('dyslexia');
    expect(med).toContain('epilepsy');
  });

  it('contains expected safeguarding terms', () => {
    const saf = keywords.safeguarding.map((t) => t.toLowerCase());
    expect(saf).toContain('social services');
    expect(saf).toContain('child protection');
  });

  it('contains expected family terms', () => {
    const fam = keywords.family.map((t) => t.toLowerCase());
    expect(fam).toContain('mother');
    expect(fam).toContain('father');
    expect(fam).toContain('brother');
    expect(fam).toContain('sister');
  });
});

describe('generalisations.json', () => {
  it('has expected category keys', () => {
    expect(generalisations).toHaveProperty('SEN');
    expect(generalisations).toHaveProperty('PP');
    expect(generalisations).toHaveProperty('LAC');
  });

  it('maps EHCP to SEN: Yes', () => {
    expect(generalisations.SEN.EHCP).toBe('SEN: Yes');
  });

  it('maps LAC to Additional support: Yes', () => {
    expect(generalisations.LAC.LAC).toBe('Additional support: Yes');
  });

  it('maps FSM to Disadvantaged: Yes', () => {
    expect(generalisations.PP.FSM).toBe('Disadvantaged: Yes');
  });

  it('all values are non-empty strings', () => {
    for (const [, mappings] of Object.entries(generalisations)) {
      for (const [, value] of Object.entries(mappings)) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });
});
