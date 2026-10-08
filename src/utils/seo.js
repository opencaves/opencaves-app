// Search-engine helpers shared by RouteSeo and CaveSeo.

// The one URL each indexable page should be known by: a cave's place on the
// map and its sub-views (medias, maps, edit, sistemas) all point to the cave's
// own page, /caves/<id> (as the server-rendered pages, functions/js/seo).
export function canonicalPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  const cave = /^\/map\/([^/]+)/.exec(path)
  if (cave) return `/caves/${cave[1]}`
  return path
}

// The public index pages: the cenotes and the cave systems by area, an area,
// a cave system, a cave's own page (not their editors' /edit addresses).
export function isPublicIndexPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  return path === '/caves' || path === '/sistemas' || /^\/(caves|sistemas|areas)\/(?!edit$)[^/]+$/.test(path)
}

// Public pages worth indexing. Everything else (account, sign-in, the
// editors' admin pages, edit modes) gets noindex.
export function isIndexable(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (/\/edit(\/|$)/.test(path)) return false
  return path === '/' || path === '/map' || /^\/map\/[^/]+(\/(medias|maps)(\/[^/]+)?)?$/.test(path) || ['/about', '/privacy', '/terms'].includes(path) || isPublicIndexPath(path)
}

// Plain text from the app's Markdown (cave descriptions), for meta
// descriptions: link text kept, syntax dropped, whitespace collapsed.
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

// Cuts at a word boundary, for search-result snippets (~155-160 chars).
export function truncate(text, max = 158) {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,.;:–-]+$/, '')}…`
}
