/**
 * Resolves after `ms` milliseconds.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Resolves on the next animation frame (once the browser has laid out what
 * changed before it).
 *
 * @returns {Promise<void>}
 */
export function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}
