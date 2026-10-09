import { ASSETS_LIST_CONFIG, COVER_IMAGE_HEIGHT_RATIO } from './resultPane'

const PANE_SM_MINIMAL_HEIGHT = /* padding top: var(--oc-pane-padding-block) * 1.4 */ (16 * 1.4) + /* header height */ 30 + /* padding bottom  */ (16 * .6) + 73.33

export const APP_NAME = 'OpenCaves'
export const APP_TITLE = 'OpenCaves' // For use in the page <title> and in the app title bar
// The site's address (canonical URLs, shared links) and its source code; the
// Cloud Functions repeat them (functions/js/constants.js).
export const SITE_URL = 'https://opencaves.org'
export const GITHUB_URL = 'https://github.com/opencaves/opencaves-app'
export const CHANGELOG_URL = `${GITHUB_URL}/blob/main/CHANGELOG.md`
// The "OpenCaves" record of the sources collection: the source of the texts
// written in the app (an edited text gets it; utils/textSources.js).
export const OPEN_CAVES_SOURCE_ID = '-KPZg4jqj7O4qkqR0gNl'
export const PANE_WIDTH = 400
// The galleries' thumbnail list (photos, maps) on a short landscape screen -
// a phone held sideways: narrower, leaving the photo most of the width.
export const GALLERY_PANE_WIDTH_COMPACT = 260
export const COMPACT_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 500px)'
export const PANE_OPEN_THRESHOLD = .7
export const PANE_INITIAL_BREAKPOINT = .33
// export const PANE_BREAKPOINTS = [.08, .33, 1]
// (The server, rendering the public pages, has no window: the map's sheet is
// never drawn there.)
export const PANE_BREAKPOINTS = [PANE_SM_MINIMAL_HEIGHT / (typeof window === 'undefined' ? 800 : window.innerHeight), .33, 1]
export const RESULT_PANE_MIN_HEIGHT = 300
// The search bar, as Material Design 3's: 56dp tall, fully rounded (half its
// height), 16dp from the screen's edges - on desktop too, where 24dp would
// leave it under MD3's 360dp minimum width above the 400px pane. Its look is
// shared by what floats with it (a sticky pane header); SearchBarMockup.scss
// and index.html's loading shell repeat it.
export const SEARCH_BAR_HEIGHT = 56
export const SEARCH_BAR_MARGIN = 16
export const SEARCH_BAR_SHADOW = '0 2px 4px rgba(0, 0, 0, 0.2), 0 -1px 0px rgba(0, 0, 0, 0.02)'
export const SEARCH_BAR_RADIUS = `${SEARCH_BAR_HEIGHT / 2}px`
// Where a sticky header in the result pane stops: 8px under the search bar
// floating over the pane.
export const RESULT_PANE_STICKY_TOP = SEARCH_BAR_MARGIN + SEARCH_BAR_HEIGHT + 8
export const SNACKBAR_DEFAULT_AUTO_HIDE_DURATION = 6000
export const SCROLLBAR_TRACK_HEIGHT = 8
export const SCROLLBAR_STEP_FACTOR = 38
export const THUMBNAIL_FORMATS = ['webp']
export const THUMBNAIL_FOLDER = 'thumbnails'
// A panorama's small copies, which can show a view taken in the viewer
// instead of the whole flattened sphere (the setViewThumbnail function).
export const VIEW_THUMBNAIL_SIZES = ['coverImage', 'resultThumbnail', 'mediaThumbnail']
export const CAVE_ASSETS_SIZES = {
  coverImage: `${PANE_WIDTH}x${Math.round(PANE_WIDTH * COVER_IMAGE_HEIGHT_RATIO)}`,
  resultThumbnail: `${Math.round(ASSETS_LIST_CONFIG.widthRatio * ASSETS_LIST_CONFIG.height)}x${ASSETS_LIST_CONFIG.height}`,
  mediaThumbnail: '400x800'
}

const MAGNIFICATION_FACTOR = 1.5022

export const IMAGE_SIZES = {
  coverImage: {
    width: Math.round(400 * MAGNIFICATION_FACTOR),
    height: Math.round(225 * MAGNIFICATION_FACTOR),
    // width: 400,
    // height: 225,
    fit: 'cover'
  },
  resultThumbnail: {
    width: Math.round(240 * MAGNIFICATION_FACTOR),
    height: Math.round(300 * MAGNIFICATION_FACTOR),
    fit: 'outside'
  },
  mediaThumbnail: {
    width: 400,
    height: 800,
    fit: 'inside'
  },
  '1024': {
    width: 1024,
    fit: 'outside'
  },
  '1536': {
    width: 1536,
    fit: 'outside'
  },
  '4k': {
    width: 3840,
    fit: 'outside'
  }
}