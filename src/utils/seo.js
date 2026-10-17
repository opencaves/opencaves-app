// Search-engine helpers shared by RouteSeo and CaveSeo.
import { TITLE_NAME } from '@/config/app.js'
import { REGION_BBOX } from '@/config/map.js'
import { caveTitle, sistemaPageTitle } from '@/utils/pageTitles.js'
import { sistemaTitle } from '@/utils/sistemaTitle.js'

/**
 * The one URL each indexable page should be known by: a cave's place on the
 * map and its sub-views (medias, maps, edit, sistemas) all point to the cave's
 * own page, /caves/<id> (as the server-rendered pages, functions/js/seo).
 *
 * @param {string} pathname
 * @returns {string}
 */
export function canonicalPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  const cave = /^\/map\/([^/]+)/.exec(path)
  if (cave) return `/caves/${cave[1]}`
  return path
}

/**
 * The public index pages: the cenotes and the cave systems by area, an area,
 * a cave system, a cave's own page (not their editors' /edit addresses).
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isPublicIndexPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  return path === '/caves' || path === '/sistemas' || /^\/(caves|sistemas|areas)\/(?!edit$)[^/]+$/.test(path)
}

/**
 * Public pages worth indexing. Everything else (account, sign-in, the
 * editors' admin pages, edit modes) gets noindex.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isIndexable(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (/\/edit(\/|$)/.test(path)) return false
  return path === '/' || path === '/map' || /^\/map\/[^/]+(\/(medias|maps)(\/[^/]+)?)?$/.test(path) || ['/about', '/privacy', '/terms'].includes(path) || isPublicIndexPath(path)
}

/**
 * Plain text from the app's Markdown (cave descriptions), for meta
 * descriptions: link text kept, syntax dropped, whitespace collapsed.
 *
 * @param {string} [markdown='']
 * @returns {string}
 */
export function markdownToPlainText(markdown = '') {
  return markdown
    // Length tags (:length[45 m]) as their value, a whole number (as the
    // app shows them: "14.9 m" as 15 m).
    .replace(/:length\[([^\]]*)]/g, (_, text) => text.replace(/\d[\d,]*\.\d+/, (n) => Math.round(Number(n.replace(/,/g, ''))).toLocaleString('en-US')))
    // A stray <br> (older editor saves) isn't text.
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Cuts at a word boundary, for search-result snippets (~155-160 chars).
 *
 * @param {string} text
 * @param {number} [max=158]
 * @returns {string}
 */
export function truncate(text, max = 158) {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,.;:–-]+$/, '')}…`
}

/**
 * The words the pages' titles add, in the app's language (`seo.titleWords`;
 * the server's English ones: functions/js/seo/shared.js' TITLE_WORDS).
 *
 * @param {(key: string, options?: object) => string} t - The `seo` namespace's.
 * @returns {import('@/utils/pageTitles.js').TitleWords}
 */
export function titleWords(t) {
  return {
    separator: t('titleWords.separator'),
    cenote: [t('titleWords.cenoteLong'), t('titleWords.cenoteShort')],
    cave: [t('titleWords.caveLong'), t('titleWords.caveShort')],
    sistemaMaps: [t('titleWords.sistemaMapsLong'), t('titleWords.sistemaMapsShort')],
    sistema: [t('titleWords.sistemaLong')],
  }
}

/**
 * A cave's <title> (its page, its place on the map), " / Open Caves"
 * included - as the server's (functions/js/seo/cavePage.js), in the app's
 * language ({@link caveTitle}).
 *
 * @param {string} label - Its name, or its placeholder.
 * @param {{latitude?: number, longitude?: number}|null|undefined} location
 * @param {(key: string, options?: object) => string} t - The `seo` namespace's.
 * @returns {string}
 */
export function caveHeadTitle(label, location, t) {
  return caveTitle({ label, location, bbox: REGION_BBOX, words: titleWords(t), brand: ` / ${TITLE_NAME}` })
}

/**
 * A cave system's page's <title>, " / Open Caves" included - as the
 * server's (functions/js/seo/indexPages.js), in the app's language
 * ({@link sistemaPageTitle}): "Sac Actun cave system", or its name when it
 * says it's a system ({@link sistemaTitle}), and its words.
 *
 * @param {{name: string, maps?: string[]}} sistema
 * @param {(key: string, options?: object) => string} t - The `seo` namespace's.
 * @returns {string}
 */
export function sistemaHeadTitle(sistema, t) {
  const title = sistemaTitle(sistema.name, (name) => t('titleWords.sistemaName', { name }))
  return sistemaPageTitle({ title, hasMaps: Array.isArray(sistema.maps) && sistema.maps.length > 0, words: titleWords(t), brand: ` / ${TITLE_NAME}` })
}
