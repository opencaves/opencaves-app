// Search-engine helpers shared by RouteSeo and CaveSeo.

export const SITE_URL = 'https://opencaves.org'

// The one URL each indexable page should be known by: a cave's sub-views
// (medias, maps, edit, sistemas) all point to the cave itself, and / (a
// redirect) to /map.
export function canonicalPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return '/map'
  const cave = /^\/map\/([^/]+)/.exec(path)
  if (cave) return `/map/${cave[1]}`
  return path
}

// Public pages worth indexing. Everything else (account, sign-in, the
// editors' admin pages, edit modes) gets noindex.
export function isIndexable(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (/\/edit(\/|$)/.test(path)) return false
  return path === '/' || path === '/map' || /^\/map\/[^/]+(\/(medias|maps)(\/[^/]+)?)?$/.test(path) || ['/about', '/privacy', '/terms'].includes(path)
}

// Plain text from the app's Markdown (cave descriptions), for meta
// descriptions: link text kept, syntax dropped, whitespace collapsed.
export function markdownToPlainText(markdown = '') {
  return markdown
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Cuts at a word boundary, for search-result snippets (~155-160 chars).
export function truncate(text, max = 158) {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,.;:–-]+$/, '')}…`
}
