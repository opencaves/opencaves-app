import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { ENFORCE_APP_CHECK, REGION } from '../constants.js'

// A web page's details for the Further reading form (Paste a link): fetched
// here, as browsers can't read another site's page. Only public web
// addresses: never the project's own network or the machine's (an address
// that resolves to a private, loopback or link-local one is refused, at each
// redirect too) - a basic guard; the page is only read, and its details alone
// are returned.

const TIMEOUT_MS = 8000
// The page read at most this far: its <head> is near the top.
const MAX_BYTES = 1024 * 1024
const MAX_REDIRECTS = 5
const MAX_URL_LENGTH = 2000
const USER_AGENT = 'OpenCaves link preview (+https://opencaves.org)'

// Not public: this host, private networks, link-local (cloud metadata),
// carrier-grade NAT, documentation and multicast ranges.
const BLOCKED = new BlockList()
for (const [network, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3]]) {
  BLOCKED.addSubnet(network, prefix, 'ipv4')
}
for (const [network, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96], ['2001:db8::', 32]]) {
  BLOCKED.addSubnet(network, prefix, 'ipv6')
}

/**
 * Whether an IP address is a public one ({@link BLOCKED}'s aren't); an IPv4
 * address mapped in IPv6 (::ffff:a.b.c.d) is checked as IPv4.
 *
 * @param {string} address
 * @returns {boolean}
 */
export function isPublicAddress(address) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1]
  const ip = mapped || address
  const family = isIP(ip)
  if (!family) return false
  return !BLOCKED.check(ip, family === 4 ? 'ipv4' : 'ipv6')
}

// The address, if it may be fetched: http or https, the default ports, a
// host whose every address is public.
async function checkedUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new HttpsError('invalid-argument', 'Not a web address.')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) {
    throw new HttpsError('invalid-argument', 'Only http and https addresses.')
  }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true }).catch(() => [])
  if (addresses.length === 0) throw new HttpsError('not-found', 'No such site.')
  if (!addresses.every(({ address }) => isPublicAddress(address))) throw new HttpsError('permission-denied', 'Not a public address.')
  return url
}

// The page (its first MAX_BYTES), following redirects itself (each one checked).
async function fetchPage(start) {
  let url = await checkedUrl(start)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' } })
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.get('location')) {
      await response.body?.cancel()
      url = await checkedUrl(new URL(response.headers.get('location'), url).href)
      continue
    }
    if (!response.ok) {
      await response.body?.cancel()
      throw new HttpsError('unavailable', `The site answered ${response.status}.`)
    }
    const contentType = response.headers.get('content-type') || ''
    if (!/html/i.test(contentType) || !response.body) {
      await response.body?.cancel()
      return { url, contentType, html: '' }
    }
    // Read up to MAX_BYTES, then stopped.
    const chunks = []
    let length = 0
    const reader = response.body.getReader()
    while (length < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      length += value.length
    }
    await reader.cancel().catch(() => {})
    return { url, contentType, html: Buffer.concat(chunks).toString('utf8') }
  }
  throw new HttpsError('unavailable', 'Too many redirects.')
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const decode = (text) => text
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
  .replace(/&([a-z]+);/gi, (entity, word) => ENTITIES[word.toLowerCase()] ?? entity)
const clean = (text, max) => decode(text || '').replace(/\s+/g, ' ').trim().slice(0, max) || null

/**
 * A page's details from its HTML: the citation_* tags scholarly sites write
 * (Google Scholar's), Dublin Core's, else Open Graph's and its <title>.
 *
 * @param {string} html
 * @returns {{title: string|null, authors: string[], year: string|null, publishedIn: string|null, doi: string|null, language: string|null}}
 */
export function pageDetails(html) {
  const headEnd = html.search(/<\/head>/i)
  const head = headEnd >= 0 ? html.slice(0, headEnd) : html
  const meta = new Map()
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = Object.fromEntries([...tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)].map(([, key, a, b, c]) => [key.toLowerCase(), a ?? b ?? c]))
    const key = (attributes.name || attributes.property || '').toLowerCase()
    if (!key || attributes.content == null) continue
    meta.set(key, [...(meta.get(key) || []), attributes.content])
  }
  const first = (...keys) => keys.map((key) => meta.get(key)?.[0]).find((value) => value?.trim())
  const date = first('citation_publication_date', 'citation_date', 'citation_online_date', 'dc.date', 'article:published_time')
  const doi = first('citation_doi', 'dc.identifier', 'prism.doi')?.match(/10\.\d{4,9}\/[^\s"<>]+/)?.[0]
  const authors = (meta.get('citation_author') || meta.get('dc.creator') || []).map((author) => clean(author, 240)).filter(Boolean)
  return {
    title: clean(first('citation_title', 'dc.title', 'og:title') || /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1], 500),
    authors: [...new Set(authors)].slice(0, 50),
    year: date?.match(/\b(1[5-9]|20)\d{2}\b/)?.[0] || null,
    // Where it appeared (a journal, a book, the site), not its publishing company.
    publishedIn: clean(first('citation_journal_title', 'citation_conference_title', 'citation_inbook_title', 'citation_book_title', 'og:site_name'), 300),
    doi: doi ? decode(doi).replace(/[.,;]+$/, '') : null,
    language: (first('citation_language', 'dc.language') || /<html\b[^>]*\blang\s*=\s*["']?([a-z]{2,3})/i.exec(html)?.[1] || '').toLowerCase().slice(0, 3) || null,
  }
}

/**
 * A web page's details, to fill the Further reading form (registered
 * accounts): { url (where it ended up, after redirects), contentType, title,
 * authors, year, publishedIn, doi, language (as the page gives it: "en",
 * "spa"...) } - each null when the page doesn't say ({@link pageDetails}). A
 * PDF's link comes back with its contentType alone.
 *
 * @param {CallableRequest} request - Its data: { url }.
 * @throws {HttpsError} unauthenticated without an account; invalid-argument for an address that isn't http(s);
 *   permission-denied for one that isn't public; not-found, unavailable or deadline-exceeded when the page can't be read.
 */
export const linkMetadata = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK, memory: '256MiB', timeoutSeconds: 30, maxInstances: 5 }, async (request) => {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('unauthenticated', 'Sign in to add a link.')
  }
  const value = request.data?.url
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) throw new HttpsError('invalid-argument', 'url must be a web address.')
  try {
    const { url, contentType, html } = await fetchPage(value.trim())
    return { url: url.href, contentType: contentType.split(';')[0].trim() || null, ...pageDetails(html) }
  } catch (error) {
    if (error instanceof HttpsError) throw error
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    logger.info('[linkMetadata] could not read the page', { url: value, error: error?.message })
    throw new HttpsError(timedOut ? 'deadline-exceeded' : 'unavailable', 'The page could not be read.')
  }
})
