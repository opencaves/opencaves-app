// What the server-rendered pages (the cave page, the index pages) share: the
// site's index.html as their shell, and the helpers that put a page's <head>
// tags and text into it. Search engines and link previews get the page's
// content in the HTML; the app then replaces #root and reuses those <head>
// tags (src/utils/headTags.js), so the two must stay in step.
import { brotliCompressSync, constants as zlib, gzipSync } from 'node:zlib'
import { APP_TITLE, SITE_URL } from '../constants.js'

// The hosts whose app shell may serve as the page: the site and this
// project's Hosting domains (preview channels: opencaves--<channel>-<hash>).
const ALLOWED_HOST_PATTERN = /^(opencaves\.org|www\.opencaves\.org|opencaves(--[-a-z0-9]+)?\.(web\.app|firebaseapp\.com))$/

// The last shell fetched from each origin: used only when fetching fails.
const shells = new Map()

// The served site's app shell - app.html, the build's index.html renamed so
// Hosting doesn't serve it as a static file for / (vite.config.js) - or
// index.html from a build made before (a preview channel has its own build);
// the production one when called directly (the emulator) or from any other
// host (a forged X-Forwarded-Host must not choose where the page comes from).
// Fetched on every call (19 KB, ~80 ms; these functions run only when the CDN
// hasn't the page): a shell kept for minutes outlived a deploy - pages drawn
// on the old build's shell named files Hosting no longer had, and the CDN
// kept them an hour. (Hosting ignores If-None-Match: no cheaper check.)
export async function shellFor(req) {
  const host = (req.get('x-forwarded-host') || req.hostname || '').toLowerCase()
  const origin = ALLOWED_HOST_PATTERN.test(host) ? `https://${host}` : SITE_URL
  try {
    let response = await fetch(`${origin}/app.html`, { cache: 'no-store' })
    if (response.status === 404) response = await fetch(`${origin}/index.html`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`app shell from ${origin}: ${response.status}`)
    const html = await response.text()
    shells.set(origin, html)
    return html
  } catch (error) {
    if (shells.has(origin)) return shells.get(origin)
    throw error
  }
}

// The pages compressed by the function itself: Hosting passes a function's
// response on as it is, uncompressed (measured: the server-rendered /caves
// arrived at 678 KB; Brotli brings it to about 63 KB). Brotli at quality 5
// (about 4 ms for that page; 11 is barely smaller and far slower), gzip for a
// client without it. Vary: the CDN keeps one copy per encoding.
const BROTLI_QUALITY = 5
// The compressed copies of the latest pages, so a page the function keeps
// (ssr.js) isn't compressed again on each request.
const COMPRESSED_MAX = 40
const compressed = new Map()

function compress(html, encoding) {
  const key = `${encoding}:${html}`
  let body = compressed.get(key)
  if (!body) {
    body = encoding === 'br' ? brotliCompressSync(html, { params: { [zlib.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY, [zlib.BROTLI_PARAM_SIZE_HINT]: Buffer.byteLength(html) } }) : gzipSync(html)
    compressed.set(key, body)
    if (compressed.size > COMPRESSED_MAX) compressed.delete(compressed.keys().next().value)
  }
  return body
}

// Sends a page's HTML compressed as the client accepts (headers set before).
export function sendHtml(req, res, html, status = 200) {
  const accepted = req.get('accept-encoding') || ''
  const encoding = /\bbr\b/.test(accepted) ? 'br' : /\bgzip\b/.test(accepted) ? 'gzip' : null
  res.set('Vary', 'Accept-Encoding')
  res.status(status)
  if (!encoding) return res.send(html)
  res.set('Content-Encoding', encoding)
  return res.send(compress(html, encoding))
}

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// The app's Markdown as plain text (as src/utils/seo.js's markdownToPlainText),
// paragraph breaks kept.
export function plainParagraphs(markdown = '') {
  return String(markdown ?? '')
    // A length tag as its value, a whole number (as the app shows it).
    .replace(/:length\[([^\]]*)]/g, (_, text) => text.replace(/\d[\d,]*\.\d+/, (n) => Math.round(Number(n.replace(/,/g, ''))).toLocaleString('en-US')))
    // A stray <br> (older editor saves) isn't text.
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~`]+/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

// Cuts at a word boundary, for search-result snippets (as seo.js's truncate).
export function truncate(text, max = 158) {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,.;:–-]+$/, '')}…`
}

// JSON-LD inside a <script>: "<" escaped so no text can close the element.
export const jsonLdScript = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`

// The share image (og:image) of every page: public/og-image.png.
const SHARE_IMAGE = { url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: 'OpenCaves - open data for cave diving' }

// A page's <head> tags (title, description, canonical, og:, structured
// data) and its breadcrumbs. path: the page's path ("/caves"); canonical:
// the path search engines should know it by, when another (a cave's place on
// the map: its own page); jsonLd: structured data (schema.org) for the
// page's <head>, if any - structuredData too (a cave's: in its text for the
// plain pages, in <head> for the rendered ones); trail: its breadcrumbs,
// [{ name, path }] from the landing page to the page itself - links above
// its content, and a BreadcrumbList for search results.
function pageHead({ title, description, path, canonical = path, ogType = 'website', jsonLd = null, structuredData = null, trail = null }, { withStructuredData = false } = {}) {
  const url = `${SITE_URL}${canonical}`
  const breadcrumbs = trail?.length
    ? {
        html: `<nav aria-label="Breadcrumbs" class="oc-ssr-breadcrumbs">${trail.map(({ name, path: crumbPath }, i) => (i === trail.length - 1 ? `<span aria-current="page">${escapeHtml(name)}</span>` : `<a href="${escapeHtml(crumbPath)}">${escapeHtml(name)}</a>`)).join(' &rsaquo; ')}</nav>
`,
        jsonLd: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: trail.map(({ name, path: crumbPath }, i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${SITE_URL}${crumbPath}` })) },
      }
    : null
  const head = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:type" content="${escapeHtml(ogType)}" />`,
    `<meta property="og:site_name" content="${APP_TITLE}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${SHARE_IMAGE.url}" />`,
    `<meta property="og:image:width" content="${SHARE_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${SHARE_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(SHARE_IMAGE.alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    jsonLd ? jsonLdScript(jsonLd) : '',
    withStructuredData && structuredData ? jsonLdScript(structuredData) : '',
    breadcrumbs ? jsonLdScript(breadcrumbs.jsonLd) : '',
  ].filter(Boolean).join('\n  ')
  return { head, breadcrumbs }
}

// The shell with its own title and description replaced by the page's
// <head> tags. Replacer functions, not strings: a "$&" or "$'" in a name
// would otherwise be read as a replacement pattern.
const withHead = (shell, head) => shell
  .replace(/<title>[^<]*<\/title>\s*/i, '')
  .replace(/<meta name="description"[^>]*>\s*/i, '')
  .replace(/<head>/i, () => `<head>\n  ${head}`)

// The shell with the page's <head> tags and, when it has a text (body: its
// HTML, already escaped), that text and its breadcrumbs in #root - which the
// app replaces when it starts.
export function renderPage(shell, page) {
  const { head, breadcrumbs } = pageHead(page)
  const html = withHead(shell, head)
  if (!page.body) return html
  return html.replace('<div id="root"></div>', () => `<div id="root">${breadcrumbs ? breadcrumbs.html : ''}${page.body}</div>`)
}

// A string as a <script>'s JSON: nothing in it can close the element.
const SCRIPT_UNSAFE = { '<': '\\u003c', '\u2028': '\\u2028', '\u2029': '\\u2029' }
const scriptJson = (value) => JSON.stringify(value).replace(/[<\u2028\u2029]/g, (c) => SCRIPT_UNSAFE[c])

// The page rendered by the app itself (ssr.js): the same <head> tags, the
// page's styles (its stylesheets, the Emotion styles it uses) and the files
// it needs first (links: <link> tags), its HTML in #root, and what the app
// hydrates it with (window.__OC_SSR__, src/index.jsx). data-oc-ssr: no
// splash over it (index.html).
export function renderSsrPage(shell, page, { html, styles, ssr }, links) {
  const { head } = pageHead(page, { withStructuredData: true })
  return withHead(shell, `${head}\n  ${links}\n  ${styles}`)
    .replace(/<html([^>]*)>/i, (_, attributes) => `<html${attributes} data-oc-ssr>`)
    .replace('<div id="root"></div>', () => `<div id="root">${html}</div>\n  <script>window.__OC_SSR__ = ${scriptJson(ssr)}</script>`)
}

// The path's segment, decoded, or '' when it can't be (bad % escapes).
export function decodeSegment(segment = '') {
  try {
    return decodeURIComponent(segment)
  } catch {
    return ''
  }
}
