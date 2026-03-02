/**
 * Round half away from zero.
 * CRITICAL: All rounding in the library MUST use this function.
 * Never use Math.round().
 *
 * @param {number} x - Number to round
 * @returns {number} Rounded integer
 */
export function roundHalfAway(x) {
  return Math.sign(x) * Math.floor(Math.abs(x) + 0.5);
}
