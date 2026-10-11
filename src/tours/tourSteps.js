// The guided tours' steps, as data (run by tourEngine.js). Each step points
// at an element by its oc- class names - renaming one of those classes
// breaks its step (it's then skipped, not shown pointing at nothing).

/**
 * What a step can know of the app and the device.
 *
 * @typedef {object} TourContext
 * @property {boolean} phone - A phone-sized screen (the map's bottom sheet, the search bar's menu).
 * @property {boolean} compact - A screen too narrow for the app bar's links (the navigation drawer).
 * @property {boolean} loggedIn - Signed in to an account (not an anonymous session).
 * @property {boolean} installed - Running as the installed app (display-mode: standalone...).
 * @property {'ios'|'android'|'safari'|'chromium'|'other'} platform - How this browser installs a web app.
 */

/**
 * One step of a tour.
 *
 * @typedef {object} TourStep
 * @property {string} id - Its texts: tours:steps.<tour id>.<id>.title / .text.
 * @property {string|string[]|(() => Element|null)} [target] - The element to point at: a selector, the first
 *   of several that shows one, or a function finding it. None: the popover is centred.
 * @property {string} [route] - The page it needs (navigated to through the router first).
 * @property {'appMenu'|'navDrawer'} [open] - A menu to open first (closed again once the tour leaves it).
 * @property {boolean} [caveLayer] - The map's cave layer shown for it (put back as it was at the end).
 * @property {(context: TourContext) => boolean} [when] - Whether the tour has this step at all.
 * @property {(context: TourContext) => string} [variant] - Its texts' variant: steps.<tour>.<id>.<variant>.title / .text.
 * @property {'top'|'right'|'bottom'|'left'} [side] - Where the popover goes (if it fits).
 * @property {'start'|'center'|'end'} [align]
 * @property {number} [timeout] - How long to wait for its element, in ms (else skipped).
 */

/**
 * A tour.
 *
 * @typedef {object} Tour
 * @property {string} id - Its texts: tours:list.<id>, tours:steps.<id>.
 * @property {TourStep[]} steps
 */

// A cave every database has, with photos and survey maps, for the steps
// about a cave's details.
const SAMPLE_CAVE_ID = '-KPZkVMp35At9PGUPyqr'

/**
 * The map's pin nearest the middle of the screen.
 *
 * @returns {Element|null}
 */
function centralPin() {
  const middleX = window.innerWidth / 2
  const middleY = window.innerHeight / 2
  let best = null
  let bestDistance = Infinity
  for (const pin of document.querySelectorAll('.oc-map--marker-icon')) {
    const { left, top, width, height } = pin.getBoundingClientRect()
    if (!width || !height || left < 0 || top < 0 || left + width > window.innerWidth || top + height > window.innerHeight) continue
    const distance = Math.hypot(left + width / 2 - middleX, top + height / 2 - middleY)
    if (distance < bestDistance) {
      best = pin
      bestDistance = distance
    }
  }
  return best
}

/** @type {Record<string, Tour>} */
export const TOURS = {
  discover: {
    id: 'discover',
    steps: [
      { id: 'welcome', route: '/map' },
      { id: 'search', route: '/map', target: '.oc-search-bar--box', side: 'bottom' },
      { id: 'pins', route: '/map', target: centralPin, timeout: 8000 },
      { id: 'filters', route: '/map', target: '.oc-search-bar--filter', side: 'bottom' },
      { id: 'caveLayer', route: '/map', target: '.oc-cave-layer-button', side: 'left' },
      { id: 'legend', route: '/map', target: '.oc-cave-layer-legend', caveLayer: true, side: 'left', align: 'end' },
      { id: 'cave', route: `/map/${SAMPLE_CAVE_ID}`, target: ['.oc-result-pane-lg', '.oc-result-pane-sm .oc-result-pane--card'], side: 'right', timeout: 8000 },
      { id: 'quickActions', route: `/map/${SAMPLE_CAVE_ID}`, target: '.oc-quick-actions', side: 'right' },
      { id: 'media', route: `/map/${SAMPLE_CAVE_ID}`, target: '.oc-cave-media-tabs', side: 'right' },
      // Phones: below the sheet's fold.
      { id: 'coordinates', route: `/map/${SAMPLE_CAVE_ID}`, target: '.oc-results-copy-list', when: ({ phone }) => !phone, side: 'right' },
      // The site's pages: the app bar's links on wide screens; on narrower
      // ones the navigation drawer, from the map's search bar.
      { id: 'pages', route: '/caves', target: '.oc-app-bar--nav', when: ({ compact }) => !compact, variant: () => 'bar', side: 'bottom' },
      { id: 'pages', route: '/map', open: 'navDrawer', target: '.oc-nav-drawer--list', when: ({ compact }) => compact, variant: () => 'drawer', side: 'bottom' },
      // The account: its menu (signed in, or on the map); signed out on the
      // other pages, the app bar's Log in and Sign up.
      { id: 'account', target: ['.oc-app-menu', '.oc-app-bar--auth'], variant: ({ loggedIn }) => (loggedIn ? 'member' : 'visitor'), side: 'bottom', align: 'end' },
      { id: 'feedback', target: '.oc-feedback-tab', side: 'left' },
      { id: 'end' },
    ],
  },
  install: {
    id: 'install',
    steps: [
      { id: 'installed', when: ({ installed }) => installed },
      { id: 'why', when: ({ installed }) => !installed },
      { id: 'how', when: ({ installed }) => !installed, variant: ({ platform }) => platform },
      { id: 'updates' },
    ],
  },
  offline: {
    id: 'offline',
    steps: [
      { id: 'intro' },
      // The account menu's switch: on the map, where everyone has the menu.
      { id: 'previews', route: '/map', open: 'appMenu', target: '.oc-offline-previews-toggle', side: 'left' },
      { id: 'save', route: `/map/${SAMPLE_CAVE_ID}`, target: '.oc-quick-actions--save', variant: ({ loggedIn }) => (loggedIn ? 'member' : 'visitor'), side: 'right', timeout: 8000 },
      { id: 'savedCaves', route: '/account', target: '.oc-saved-caves-list', when: ({ loggedIn }) => loggedIn, side: 'top' },
      { id: 'storage', route: '/account', target: '.oc-offline-storage-section', when: ({ loggedIn }) => loggedIn, side: 'top' },
      { id: 'whileOffline' },
    ],
  },
  whatsNew: {
    id: 'whatsNew',
    steps: [
      { id: 'page', route: '/whats-new', target: '.oc-whats-new .oc-index-page-header', side: 'bottom', timeout: 10000 },
      { id: 'kinds', route: '/whats-new', target: '.oc-whats-new--filters', side: 'bottom' },
      { id: 'changes', route: '/whats-new', target: '.oc-whats-new--change-filters', side: 'bottom' },
      { id: 'entry', route: '/whats-new', target: '.oc-whats-new--item', side: 'bottom' },
    ],
  },
}
