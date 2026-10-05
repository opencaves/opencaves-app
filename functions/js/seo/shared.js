// What the server-rendered pages (the cave page, the index pages) share: the
// site's index.html as their shell, and the helpers that put a page's <head>
// tags and text into it. Search engines and link previews get the page's
// content in the HTML; the app then replaces #root and reuses those <head>
// tags (src/utils/headTags.js), so the two must stay in step.
export const SITE_URL = 'https://opencaves.org'
export const APP_TITLE = 'Open Caves'
const SHELL_TTL_MS = 5 * 60 * 1000

// The hosts whose app shell may serve as the page: the site and this
// project's Hosting domains (preview channels: opencaves--<channel>-<hash>).
const ALLOWED_HOST_PATTERN = /^(opencaves\.org|www\.opencaves\.org|opencaves(--[-a-z0-9]+)?\.(web\.app|firebaseapp\.com))$/

const shells = new Map()

// The served site's app shell - app.html, the build's index.html renamed so
// Hosting doesn't serve it as a static file for / (vite.config.js) - or
// index.html from a build made before (a preview channel has its own build);
// the production one when called directly (the emulator) or from any other
// host (a forged X-Forwarded-Host must not choose where the page comes from).
export async function shellFor(req) {
  const host = (req.get('x-forwarded-host') || req.hostname || '').toLowerCase()
  const origin = ALLOWED_HOST_PATTERN.test(host) ? `https://${host}` : SITE_URL
  const cached = shells.get(origin)
  if (cached && Date.now() - cached.at < SHELL_TTL_MS) return cached.html
  let response = await fetch(`${origin}/app.html`)
  if (response.status === 404) response = await fetch(`${origin}/index.html`)
  if (!response.ok) throw new Error(`app shell from ${origin}: ${response.status}`)
  const html = await response.text()
  shells.set(origin, { html, at: Date.now() })
  return html
}

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// The app's Markdown as plain text (as src/utils/seo.js's markdownToPlainText),
// paragraph breaks kept.
export function plainParagraphs(markdown = '') {
  return String(markdown ?? '')
    .replace(/:length\[([^\]]*)]/g, '$1')
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

// The shell with the page's <head> tags and #root content. path: the page's
// canonical path ("/caves"); body: its HTML, already escaped.
export function renderPage(shell, { title, description, path, body, ogType = 'website' }) {
  const url = `${SITE_URL}${path}`
  const head = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:type" content="${escapeHtml(ogType)}" />`,
    `<meta property="og:site_name" content="${APP_TITLE}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
  ].join('\n  ')

  // Replacer functions, not strings: a "$&" or "$'" in a name would otherwise
  // be read as a replacement pattern.
  return shell
    // The shell's own title and description give way to the page's.
    .replace(/<title>[^<]*<\/title>\s*/i, '')
    .replace(/<meta name="description"[^>]*>\s*/i, '')
    .replace(/<head>/i, () => `<head>\n  ${head}`)
    .replace('<div id="root"></div>', () => `<div id="root">${body}</div>`)
}

// The path's segment, decoded, or '' when it can't be (bad % escapes).
export function decodeSegment(segment = '') {
  try {
    return decodeURIComponent(segment)
  } catch {
    return ''
  }
}
