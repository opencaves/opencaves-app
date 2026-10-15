import { CROSSREF_WORKS_URL, DOCUMENT_AUTHORS_MAX, DOCUMENT_LAST_PAGES_READ, DOCUMENT_PAGES_READ, DOCUMENT_PUBLISHED_IN_MAX, DOCUMENT_TITLE_MAX } from '@/config/documents.js'
import { findDoi } from '@/utils/documents.js'
import { loadFirebase } from '@/utils/loadFirebase.js'

// What the Further reading form can fill in by itself (the person reviews it
// before saving): a PDF's own details, read in the browser with pdf.js
// (loaded only when a PDF is picked), a page's (the linkMetadata function,
// on the server), and, when either gives a DOI, the work's details from
// Crossref - which come first.

/**
 * Details found for a document, each empty when unknown.
 *
 * @typedef {object} FoundDetails
 * @property {string} [title]
 * @property {string[]} [authors]
 * @property {string} [year]
 * @property {string} [publishedIn] - Where it appeared: a journal, a book, a website.
 * @property {string} [doi]
 * @property {string} [language] - As the source gives it ("en", "eng", "en-US").
 * @property {string} [url] - A link: where it ended up (after redirects).
 * @property {string} [contentType] - A link: what it serves (a PDF's link: application/pdf).
 */

// ISO 639-1 codes as the sources give them -> the content languages' ISO
// 639-2 (the `languages` collection), for the languages caves are written
// about most.
const LANGUAGE_CODES = { en: 'eng', es: 'spa', fr: 'fra', de: 'deu', it: 'ita', pt: 'por', nl: 'nld', pl: 'pol', cs: 'ces', ru: 'rus', ja: 'jpn', zh: 'zho' }

/**
 * A language as a source gives it ("en", "en-US", "spa"), as one of the
 * content languages' codes, or ''.
 *
 * @param {string|undefined} value
 * @param {string[]} codes - The content languages' codes.
 * @returns {string}
 */
export function contentLanguageOf(value, codes) {
  const code = String(value || '').toLowerCase().split(/[-_]/)[0]
  const candidate = code.length === 2 ? LANGUAGE_CODES[code] : code
  return candidate && codes.includes(candidate) ? candidate : ''
}

const clean = (text, max) => String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

// A PDF's Author entry as names: "A; B", "A and B", "A, B" (full names).
function splitAuthors(value) {
  const text = clean(value, 2000)
  if (!text) return []
  const parts = text.includes(';') ? text.split(';') : text.split(/\s*,\s*|\s+and\s+|\s*&\s*/)
  // "Smith, J." is one name, not two: kept whole when a part has no space.
  const names = parts.every((part) => part.trim().includes(' ')) || text.includes(';') ? parts : [text]
  return names.map((name) => name.trim()).filter(Boolean).slice(0, DOCUMENT_AUTHORS_MAX)
}

// The first page's largest text: most often its title.
function titleGuess(items) {
  const sized = items.filter((item) => item.str?.trim()).map((item) => ({ text: item.str, size: Math.round(Math.hypot(item.transform[2], item.transform[3]) * 10) / 10 }))
  const sizes = [...new Set(sized.map((item) => item.size))].sort((a, b) => b - a)
  for (const size of sizes.slice(0, 3)) {
    const text = clean(sized.filter((item) => item.size === size).map((item) => item.text).join(' '), DOCUMENT_TITLE_MAX)
    // A lone letter or a page number isn't a title.
    if (text.replace(/[^\p{L}]/gu, '').length >= 8) return text
  }
  return ''
}

// A DOI in a PDF's last pages (DOCUMENT_LAST_PAGES_READ), past the first
// ones already read - the end's citation block, the last first.
async function lastPagesDoi(pdf) {
  for (let number = pdf.numPages; number > Math.max(DOCUMENT_PAGES_READ, pdf.numPages - DOCUMENT_LAST_PAGES_READ); number--) {
    const content = await (await pdf.getPage(number)).getTextContent()
    const doi = findDoi(content.items.filter((item) => 'str' in item).map((item) => item.str).join(' '))
    if (doi) return doi
  }
  return ''
}

/**
 * A PDF's details, read in the browser (pdf.js, loaded now): its
 * information's title and author, else its first page's largest text for the
 * title, and a DOI in its first pages, else in its last ones (where many
 * journals print it). Not its year: the file's dates are
 * when it was made or saved, not published (Crossref's comes with a DOI).
 *
 * @param {File} file
 * @returns {Promise<FoundDetails>}
 */
export async function readPdfDetails(file) {
  // Its legacy build: the other needs JavaScript newer than most browsers'
  // (Map's getOrInsertComputed), which this one brings.
  const [pdfjs, { default: workerSrc }] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  // No XFA forms, no fonts installed: its text alone is read (pdf.js runs no
  // script of the file).
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), enableXfa: false, disableFontFace: true, stopAtErrors: false })
  const pdf = await task.promise
  try {
    const { info } = /** @type {{info: Record<string, any>}} */ (await pdf.getMetadata().catch(() => ({ info: {} })))
    const pages = []
    for (let number = 1; number <= Math.min(DOCUMENT_PAGES_READ, pdf.numPages); number++) {
      const content = await (await pdf.getPage(number)).getTextContent()
      pages.push(content.items.filter((item) => 'str' in item))
    }
    const text = [info?.Subject, info?.Keywords, ...pages.map((items) => items.map((item) => item.str).join(' '))].filter(Boolean).join(' ')
    const title = clean(info?.Title, DOCUMENT_TITLE_MAX)
    return {
      // A title that's a file name ("Microsoft Word - draft3.docx") isn't one.
      title: title && !/\.(docx?|pdf|tex|indd)$/i.test(title) && !/^microsoft word/i.test(title) ? title : titleGuess(pages[0] || []),
      authors: splitAuthors(info?.Author),
      doi: findDoi(text) || (await lastPagesDoi(pdf)) || '',
      language: info?.Language || '',
    }
  } finally {
    // The loading task frees the document and its worker (pdf.js 6: not the document's own).
    task.destroy()
  }
}

/**
 * A work's details from Crossref, by its DOI (title, authors, year, journal
 * or book it appeared in, language), or null when Crossref doesn't know it or can't be
 * reached.
 *
 * @param {string} doi
 * @returns {Promise<FoundDetails|null>}
 */
export async function crossrefDetails(doi) {
  try {
    const response = await fetch(`${CROSSREF_WORKS_URL}${encodeURIComponent(doi).replace(/%2F/gi, '/')}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
    if (!response.ok) return null
    const { message: work } = await response.json()
    const year = ['issued', 'published', 'published-print', 'published-online', 'created'].map((key) => work?.[key]?.['date-parts']?.[0]?.[0]).find(Boolean)
    return {
      title: clean(work?.title?.[0], DOCUMENT_TITLE_MAX),
      authors: (work?.author || []).map((author) => clean([author.given, author.family].filter(Boolean).join(' ') || author.name, 240)).filter(Boolean).slice(0, DOCUMENT_AUTHORS_MAX),
      year: year ? String(year) : '',
      publishedIn: clean(work?.['container-title']?.[0], DOCUMENT_PUBLISHED_IN_MAX),
      doi: work?.DOI || doi,
      language: work?.language || '',
    }
  } catch (error) {
    console.warn('[crossref]', error)
    return null
  }
}

/**
 * A web page's details, read by the server (the linkMetadata function: a
 * page's citation tags, else its Open Graph tags and title).
 *
 * @param {string} url
 * @returns {Promise<FoundDetails>}
 * @throws {Error} As the function does (a page it can't read, an address that isn't public).
 */
export async function linkDetails(url) {
  const { callable } = await loadFirebase()
  const { data } = await callable('linkMetadata')({ url })
  return Object.fromEntries(Object.entries(data || {}).filter(([, value]) => value != null && value !== ''))
}

/**
 * Details from a first source, completed - and replaced where it gives them
 * - by Crossref's when they name a DOI ({@link crossrefDetails}).
 *
 * @param {FoundDetails} found
 * @returns {Promise<FoundDetails>}
 */
export async function withCrossref(found) {
  if (!found.doi) return found
  const work = await crossrefDetails(found.doi)
  if (!work) return found
  const merged = { ...found }
  for (const [key, value] of Object.entries(work)) {
    if (Array.isArray(value) ? value.length > 0 : value) merged[key] = value
  }
  return merged
}
