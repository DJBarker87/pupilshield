/**
 * Mulberry32 seeded PRNG.
 * Produces identical output to the Python implementation given the same seed.
 * CRITICAL: All randomness in the library MUST flow through this PRNG.
 * Never use Math.random().
 *
 * @param {number} seed - 32-bit integer seed
 * @returns {function(): number} Function returning floats in [0, 1)
 */
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates in-place shuffle using the seeded PRNG.
 *
 * @param {Array} array - Array to shuffle in place
 * @param {function(): number} prng - PRNG function returning [0, 1)
 * @returns {Array} The same array, shuffled in place
 */
export function shuffle(array, prng) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}
