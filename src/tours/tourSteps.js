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
 * @property {'ios'|'android'|'firefoxAndroid'|'safari'|'chromium'|'edge'|'firefox'|'other'} platform - How this browser installs a web app.
 * @property {string} language - The app's language as a browser has it ('en', 'fr', 'es'; Yucatec Maya: 'es').
 */

/**
 * One step of a tour.
 *
 * @typedef {object} TourStep
 * @property {string} id - Its texts: tours:steps.<tour id>.<id>.title / .text.
 * @property {string|string[]|(() => Element|null)} [target] - The element to point at: a selector, the first
 *   of several that shows one, or a function finding it. None: the popover is centred.
 * @property {string} [route] - The page it needs (navigated to through the router first).
 * @property {'appMenu'|'navDrawer'|'filterMenu'} [open] - A menu to open first (closed again once the tour leaves it).
 * @property {boolean} [caveLayer] - The map's cave layer shown for it (put back as it was at the end).
 * @property {ScrollLogicalPosition|((context: TourContext) => ScrollLogicalPosition|undefined)} [scroll] - Where its
 *   target is scrolled on the screen (scrollIntoView's block: 'start', the top of the screen); without, it's
 *   centred only when off the screen.
 * @property {number} [sheet] - On a phone, the result sheet raised to this breakpoint for it (1: full height),
 *   lowered back as it was for the next step.
 * @property {{ longitude: number, latitude: number, zoom: number }} [showMe] - A "Show me" button in its popover: the cave
 *   layer shown (put back at the end) and the map flown there (its text: steps.<tour>.<id>.showMe).
 * @property {(context: TourContext) => boolean} [when] - Whether the tour has this step at all.
 * @property {(context: TourContext) => string} [variant] - Its texts' variant: steps.<tour>.<id>.<variant>.title / .text.
 * @property {boolean|((context: TourContext) => boolean)} [tip] - A tip line under its text
 *   (steps.<tour>.<id>[.<variant>].tip), set apart; a function, only in the contexts it's true for.
 * @property {(context: TourContext) => string|undefined} [image] - A picture in its tip (its alt:
 *   steps.<tour>.<id>[.<variant>].imageAlt); none, no picture.
 * @property {(context: TourContext) => 'up'|'down'|undefined} [pointer] - A large arrow outside its popover, pointing at
 *   something out of the page (the browser's own controls).
 * @property {'top'|'right'|'bottom'|'left'|((context: TourContext) => 'top'|'right'|'bottom'|'left')} [side] - Where the
 *   popover goes (if it fits), or by the device.
 * @property {'start'|'center'|'end'|((context: TourContext) => 'start'|'center'|'end')} [align]
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
/**
 * How this browser installs a web app (the install steps' instructions).
 *
 * @returns {TourContext['platform']}
 */
export function installPlatform() {
  const agent = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)) return 'ios'
  // Firefox apart: its way to install differs (Android), or it can't (most
  // computers); Edge's install icon isn't Chrome's.
  if (/Android/.test(agent)) return /Firefox\//.test(agent) ? 'firefoxAndroid' : 'android'
  if (/Firefox\//.test(agent)) return 'firefox'
  if (/Edg\//.test(agent)) return 'edge'
  if (/Chrome\/|Chromium\//.test(agent)) return 'chromium'
  if (/Safari\//.test(agent) && /Macintosh/.test(agent)) return 'safari'
  return 'other'
}

// Where each browser keeps its install control, outside the page: near the
// edge of the page nearest to it (the address bar's end, the menu, Share, the
// File menu) - 60px in, room for the step's pointer arrow between the edge
// and its popover. None: no control (Firefox on a computer, the others).
const BROWSER_CONTROLS = {
  chromium: { top: '60px', right: '96px' },
  edge: { top: '60px', right: '96px' },
  android: { top: '60px', right: '12px' },
  firefoxAndroid: { top: '60px', right: '12px' },
  ios: { bottom: '60px', left: 'calc(50% - 1px)' },
  safari: { top: '60px', left: '40px' },
}

/**
 * A marker at the page's edge nearest to this browser's install control, for
 * a step to point at (removed when the tour ends); null when it has none.
 *
 * @returns {HTMLElement|null}
 */
export function browserControlAnchor() {
  const place = BROWSER_CONTROLS[installPlatform()]
  if (!place) return null
  let anchor = /** @type {HTMLElement|null} */ (document.querySelector('.oc-tour-anchor'))
  if (!anchor) {
    anchor = document.createElement('div')
    anchor.className = 'oc-tour-anchor'
    anchor.setAttribute('aria-hidden', 'true')
    document.body.append(anchor)
  }
  Object.assign(anchor.style, { position: 'fixed', width: '2px', height: '2px', pointerEvents: 'none', top: '', right: '', bottom: '', left: '', ...place })
  return anchor
}

// The browser's install control as it shows it (public/tours/: real captures,
// the icon circled in gold; on Android, Chrome's menu with Install app) -
// Chrome's, Edge's and Chrome Android's so far; the others' tips have none
// until captured on their devices.
// Android's is in each app language (Chrome's menu, in that language).
const INSTALL_IMAGES = { chromium: '/tours/install-chromium.webp', edge: '/tours/install-edge.webp', android: '/tours/install-android-{language}.webp' }
const CAPTURE_LANGUAGES = ['en', 'fr', 'es']
const installImage = ({ platform, language }) => INSTALL_IMAGES[platform]?.replace('{language}', CAPTURE_LANGUAGES.includes(language) ? language : 'en')

// Where the install control is from the page: down on an iPhone (Safari's
// Share, in its bottom bar), up for the others.
const installPointer = ({ platform }) => (platform === 'ios' ? 'down' : 'up')

// A step next to the browser's install control (a marker at the page's edge
// nearest to it), its hand pointing there: Discover's install step and the
// Install tour's How to install.
const AT_INSTALL_CONTROL = {
  target: browserControlAnchor,
  pointer: installPointer,
  side: ({ platform }) => (platform === 'ios' ? 'top' : 'bottom'),
  align: ({ platform }) => (platform === 'ios' ? 'center' : platform === 'safari' ? 'start' : 'end'),
}

export const TOURS = {
  discover: {
    id: 'discover',
    steps: [
      { id: 'search', route: '/map', target: '.oc-search-bar--box', side: 'bottom' },
      { id: 'pins', route: '/map', target: centralPin, timeout: 8000 },
      // The filter button, then the filter menu it opens (opened for the step).
      { id: 'filterButton', route: '/map', target: '.oc-search-bar--filter', side: 'bottom' },
      { id: 'filters', route: '/map', open: 'filterMenu', target: '.oc-filter-menu .MuiDrawer-paper', side: 'left' },
      // Show me: Carwash (Aktun Ha), the layer's fullest trace - walls,
      // relief, slopes, depth and restriction marks, details - framed whole.
      { id: 'caveLayer', route: '/map', target: '.oc-cave-layer-button', side: 'left', showMe: { longitude: -87.4874, latitude: 20.2738, zoom: 16.5 } },
      // The first step on the cave: its pane takes a moment to open.
      { id: 'quickActions', route: `/map/${SAMPLE_CAVE_ID}`, target: '.oc-quick-actions', side: 'right', timeout: 8000 },
      // On a phone, the sheet raised: the tabs and the strip in full view.
      { id: 'media', route: `/map/${SAMPLE_CAVE_ID}`, target: '.oc-cave-media-tabs', side: 'right', sheet: 1 },
      // The account: its menu (signed in, or on the map); signed out on the
      // other pages, the app bar's Log in and Sign up.
      { id: 'account', target: ['.oc-app-menu', '.oc-app-bar--auth'], variant: ({ loggedIn }) => (loggedIn ? 'member' : 'visitor'), side: 'bottom', align: 'end' },
      // Keeping informed: the What's new page's latest day of changes; on a
      // phone, a tip on where the page is in the menu, and the group
      // scrolled to the top: its date and first items above the (taller) popover.
      { id: 'whatsNew', route: '/whats-new', target: '.oc-whats-new--day', side: 'bottom', scroll: ({ phone }) => (phone ? 'start' : undefined), timeout: 10000, tip: ({ phone }) => phone },
      // Installing the app (not when it is), and keeping the data offline: the
      // account menu's switch, on the map where everyone has the menu.
      // Next to the browser's install control (a marker at the page's edge
      // nearest to it); centred where there's none.
      { id: 'install', when: ({ installed, platform }) => !installed && Boolean(BROWSER_CONTROLS[platform]), variant: ({ platform }) => platform, tip: true, image: installImage, ...AT_INSTALL_CONTROL },
      { id: 'install', when: ({ installed, platform }) => !installed && !BROWSER_CONTROLS[platform], variant: ({ platform }) => platform },
      { id: 'offline', route: '/map', open: 'appMenu', target: '.oc-offline-previews-toggle', side: 'left' },
      { id: 'feedback', target: '.oc-feedback-tab', side: 'left' },
      { id: 'end' },
    ],
  },
  install: {
    id: 'install',
    steps: [
      { id: 'installed', when: ({ installed }) => installed },
      { id: 'why', when: ({ installed }) => !installed },
      // Next to the browser's install control; centred where there's none.
      { id: 'how', when: ({ installed, platform }) => !installed && Boolean(BROWSER_CONTROLS[platform]), variant: ({ platform }) => platform, ...AT_INSTALL_CONTROL },
      { id: 'how', when: ({ installed, platform }) => !installed && !BROWSER_CONTROLS[platform], variant: ({ platform }) => platform },
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
