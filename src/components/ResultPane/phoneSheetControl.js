// The phone result pane's sheet, moved from outside it (the guided tours
// raise it for a step, tourEngine.js). ResultPaneSm registers it while
// mounted; in its own module, so the tours don't import the pane.

/**
 * @typedef {object} PhoneSheetControl
 * @property {(breakpoint: number) => Promise<void>} setCurrentBreakpoint - Moves the sheet to this snap point (a fraction of its height), resolving once there.
 * @property {() => number | Promise<number>} getCurrentBreakpoint - The snap point it's at.
 */

/** @type {PhoneSheetControl | null} */
let current = null

/**
 * Registers the sheet now on screen, and returns what unregisters it (only
 * if it's still the one registered).
 *
 * @param {PhoneSheetControl} control
 * @returns {() => void}
 */
export function registerPhoneSheet(control) {
  current = control
  return () => {
    if (current === control) current = null
  }
}

/**
 * The phone sheet on screen, if any.
 *
 * @returns {PhoneSheetControl | null}
 */
export function getPhoneSheet() {
  return current
}
