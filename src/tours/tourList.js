// The guided tours (coach marks: a tooltip beside a highlighted element, one
// step after another). Only their ids are here, for the menus' "Take the
// tour" dialog (ToursDialog) - their steps (tourSteps.js) and the engine
// (tourEngine.js, driver.js) load once a tour starts, out of the main bundle.
// A tour's title and description: tours:list.<id>.title / .description.
export const TOUR_IDS = ['discover', 'install', 'offline', 'whatsNew']

// The main tour, offered on a first visit (TourPrompt).
export const MAIN_TOUR_ID = 'discover'

// The "Take the tours" dialog, opened from anywhere (the menus).
export const OPEN_TOURS_EVENT = 'oc-open-tours'

/**
 * Opens the "Take the tours" dialog (ToursDialog), over the page shown.
 */
export function openToursDialog() {
  window.dispatchEvent(new Event(OPEN_TOURS_EVENT))
}

/**
 * Starts a tour, loading its steps and the tour engine first (their own
 * chunk). Another tour still running is stopped.
 *
 * @param {string} tourId - One of {@link TOUR_IDS}.
 * @param {object} options
 * @param {(to: string) => Promise<void> | void} options.navigate - The app router's navigate.
 * @param {(key: string, options?: object) => string} options.t - The `tours` namespace's translations.
 * @param {import('@reduxjs/toolkit').EnhancedStore} options.store - The app's Redux store.
 * @returns {Promise<void>}
 */
export async function startTour(tourId, options) {
  const [{ runTour }, { TOURS }] = await Promise.all([import('./tourEngine.js'), import('./tourSteps.js')])
  const tour = TOURS[tourId]
  if (!tour) return
  runTour(tour, options)
}
