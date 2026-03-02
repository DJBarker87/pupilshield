import { describe, it, expect } from 'vitest';
import { roundHalfAway } from '../src/rounding.js';

describe('roundHalfAway', () => {
  it('rounds 0.5 to 1 (half away from zero)', () => {
    expect(roundHalfAway(0.5)).toBe(1);
  });

  it('rounds -0.5 to -1 (half away from zero)', () => {
    expect(roundHalfAway(-0.5)).toBe(-1);
  });

  it('rounds 2.5 to 3', () => {
    expect(roundHalfAway(2.5)).toBe(3);
  });

  it('rounds -2.5 to -3', () => {
    expect(roundHalfAway(-2.5)).toBe(-3);
  });

  it('rounds 0 to 0', () => {
    expect(roundHalfAway(0)).toBe(0);
  });

  it('rounds 1.4 to 1', () => {
    expect(roundHalfAway(1.4)).toBe(1);
  });

  it('rounds 1.6 to 2', () => {
    expect(roundHalfAway(1.6)).toBe(2);
  });

  it('rounds -1.4 to -1', () => {
    expect(roundHalfAway(-1.4)).toBe(-1);
  });

  it('rounds -1.6 to -2', () => {
    expect(roundHalfAway(-1.6)).toBe(-2);
  });

  it('handles large numbers', () => {
    expect(roundHalfAway(999999.5)).toBe(1000000);
    expect(roundHalfAway(-999999.5)).toBe(-1000000);
  });

  it('handles exact integers', () => {
    expect(roundHalfAway(5)).toBe(5);
    expect(roundHalfAway(-3)).toBe(-3);
  });

  it('rounds 1.5 to 2', () => {
    expect(roundHalfAway(1.5)).toBe(2);
  });

  it('rounds 3.5 to 4', () => {
    expect(roundHalfAway(3.5)).toBe(4);
  });

  it('rounds -3.5 to -4', () => {
    expect(roundHalfAway(-3.5)).toBe(-4);
  });
});
