import { theme } from '@/theme/Theme.jsx'

// Phones: the same query as useSmall() (theme.breakpoints.down('sm')), for
// deciding outside React whether Ionic will be needed.
export const PHONE_MEDIA_QUERY = theme.breakpoints.down('sm').replace(/^@media\s*/, '')

let ionicPromise = null

// Loads (once) the Ionic module (ionic.js) - see there for why it's on demand.
export function loadIonic() {
  ionicPromise ??= import('./ionic.js')
  return ionicPromise
}

export function isPhone() {
  return window.matchMedia(PHONE_MEDIA_QUERY).matches
}
