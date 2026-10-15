import { theme } from '@/theme/Theme.jsx'

// Phones: the same query as useSmall() (theme.breakpoints.down('sm')), for
// deciding outside React whether Ionic will be needed.
const PHONE_MEDIA_QUERY = theme.breakpoints.down('sm').replace(/^@media\s*/, '')

// TEMPORARY - remove with Ionic once the home-made sheet (BottomSheet) has
// passed the test on a real phone: the map's phone sheet is the home-made
// one, unless the address asks for Ionic's (?sheet=ionic, kept for the tab's
// session; ?sheet=new back to the home-made one), to compare both.
const SHEET_PARAM = 'sheet'
const SHEET_STORAGE_KEY = 'oc-sheet'
let ionicSheet = null

let ionicPromise = null

/**
 * Loads (once) the Ionic module (ionic.js) - see there for why it's on demand.
 *
 * @returns {Promise<typeof import('./ionic.js')>}
 */
export function loadIonic() {
  ionicPromise ??= import('./ionic.js')
  return ionicPromise
}

/**
 * Whether the screen is a phone's (the map's result pane a bottom sheet).
 *
 * @returns {boolean}
 */
export function isPhone() {
  return window.matchMedia(PHONE_MEDIA_QUERY).matches
}

/**
 * TEMPORARY (the device test of the home-made sheet): whether the map's
 * phone sheet is Ionic's (`?sheet=ionic`, remembered for the tab's session)
 * rather than the home-made BottomSheet. Decided once per page load, so a
 * page never switches sheets midway.
 *
 * @returns {boolean}
 */
export function usesIonicSheet() {
  if (ionicSheet === null) {
    const param = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(SHEET_PARAM)
    try {
      if (param === 'ionic') sessionStorage.setItem(SHEET_STORAGE_KEY, 'ionic')
      else if (param) sessionStorage.removeItem(SHEET_STORAGE_KEY)
      ionicSheet = sessionStorage.getItem(SHEET_STORAGE_KEY) === 'ionic'
    } catch {
      ionicSheet = param === 'ionic'
    }
  }
  return ionicSheet
}

/**
 * Whether this page needs Ionic: a phone, with Ionic's sheet chosen
 * ({@link usesIonicSheet}).
 *
 * @returns {boolean}
 */
export function needsIonic() {
  return isPhone() && usesIonicSheet()
}
