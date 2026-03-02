import { roundHalfAway } from './rounding.js';

/**
 * Draw a single sample from the Laplace distribution.
 * Formula: mu - b * sign(u) * ln(1 - 2 * |u|) where u = prng() - 0.5
 *
 * @param {number} mu - Location parameter (centre)
 * @param {number} b - Scale parameter (spread)
 * @param {function(): number} prng - Seeded PRNG returning [0, 1)
 * @returns {number} A Laplace-distributed sample
 */
export function laplace(mu, b, prng) {
  const u = prng() - 0.5;
  if (u === 0) return mu;
  return mu - b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

/**
 * Find the [lower, upper) band that a value falls into.
 * Bands are [lower inclusive, upper exclusive).
 * A value exactly on a boundary belongs to the band starting at that boundary.
 *
 * @param {number} value - The value to classify
 * @param {number[]} boundaries - Sorted ascending boundary values, e.g. [40, 50, 60, 70, 80]
 * @param {number} maxValue - Maximum possible value (e.g. 100)
 * @returns {{ lower: number, upper: number }} The band, where upper is exclusive
 */
export function getBand(value, boundaries, maxValue) {
  // Boundaries define splits. For boundaries [40, 50, 60, 70, 80] and maxValue 100:
  // Bands: [0,40), [40,50), [50,60), [60,70), [70,80), [80, maxValue+1)
  // The last band's upper is maxValue + 1 so that intMax = maxValue.
  let lower = 0;
  for (let i = 0; i < boundaries.length; i++) {
    if (value < boundaries[i]) {
      return { lower, upper: boundaries[i] };
    }
    lower = boundaries[i];
  }
  // Value is in the last band (at or above the highest boundary)
  return { lower, upper: maxValue + 1 };
}

/**
 * Add bounded Laplace noise to a single value, respecting grade boundaries.
 *
 * @param {number} value - Original numeric value
 * @param {number} maxValue - Maximum possible value in the scale
 * @param {number} noisePercent - Noise as a fraction of maxValue (e.g. 0.05 for 5%)
 * @param {number[]|null} gradeBoundaries - Sorted boundary array, or null/undefined
 * @param {function(): number} prng - Seeded PRNG
 * @returns {{ value: number, failed: boolean }} Noised value and failure flag
 */
export function addBoundedNoise(value, maxValue, noisePercent, gradeBoundaries, prng) {
  const maxNoise = maxValue * noisePercent;
  const b = maxNoise / 2;

  // Draw from Laplace centred on original value
  let noised = laplace(value, b, prng);

  // Clamp to +/- maxNoise from original
  noised = Math.max(value - maxNoise, Math.min(value + maxNoise, noised));

  if (gradeBoundaries && gradeBoundaries.length > 0) {
    const band = getBand(value, gradeBoundaries, maxValue);

    // Compute integer range within the band
    const intMin = Math.ceil(band.lower);
    // For last band (upper = maxValue + 1), intMax = maxValue
    // For intermediate bands (upper is a boundary), intMax = upper - 1
    const intMax = band.upper - 1;

    // Narrow-band guard: only 1 possible integer value
    if (intMax - intMin < 1) {
      return { value, failed: true };
    }

    // Round and clamp within band
    noised = roundHalfAway(noised);
    noised = Math.max(intMin, Math.min(intMax, noised));

    return { value: noised, failed: false };
  }

  // No grade boundaries: round and clamp to [0, maxValue]
  noised = roundHalfAway(noised);
  noised = Math.max(0, Math.min(maxValue, noised));

  return { value: noised, failed: false };
}

/**
 * Add noise to an entire column of values.
 * Non-numeric values (strings like "Absent") are passed through unchanged.
 *
 * @param {Array<number|string>} values - Column values
 * @param {number} maxValue - Maximum possible value in the scale
 * @param {number} noisePercent - Noise fraction (e.g. 0.05)
 * @param {number[]|null} gradeBoundaries - Grade boundary array or null
 * @param {function(): number} prng - Seeded PRNG
 * @returns {{ values: Array<number|string>, perturbationFailures: number }}
 */
export function addNoiseToColumn(values, maxValue, noisePercent, gradeBoundaries, prng) {
  const result = [];
  let perturbationFailures = 0;

  for (const v of values) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      result.push(v);
      continue;
    }

    const { value: noised, failed } = addBoundedNoise(v, maxValue, noisePercent, gradeBoundaries, prng);
    result.push(noised);
    if (failed) {
      perturbationFailures++;
    }
  }

  return { values: result, perturbationFailures };
}
