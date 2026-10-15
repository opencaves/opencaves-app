// A PDF's active content taken out before it's shown to everyone: what a PDF
// reader could run or open on its own - JavaScript, actions run as the file
// opens or a page shows (/OpenAction, /AA), actions launching programs or
// sending data (/Launch, /SubmitForm...), embedded files, forms. Links to web
// pages (/URI) and within the file stay. pdf-lib reads and rewrites the whole
// file: anything it can't read is refused rather than passed on.

// The PDF's first bytes: "%PDF-", within its first 1024 (as readers allow).
const MAGIC = Buffer.from('%PDF-')
const MAGIC_WITHIN = 1024

// The actions removed wherever they are (an annotation's /A, an /AA's entries,
// a /Next chain): what runs code, starts programs, sends or loads data.
const RISKY_ACTIONS = ['JavaScript', 'Launch', 'SubmitForm', 'ImportData', 'ResetForm', 'GoToE', 'RichMediaExecute', 'Rendition', 'Hide']

/**
 * A file refused by {@link sanitizePdf}, its `reason` a short code the app
 * explains (src/locales: furtherReading.rejected.<reason>).
 */
export class PdfRejectedError extends Error {
  /**
   * @param {'notPdf'|'unreadable'|'encrypted'|'noPages'|'tooLarge'} reason
   * @param {unknown} [cause]
   */
  constructor(reason, cause) {
    super(`PDF refused: ${reason}`, { cause })
    this.reason = reason
  }
}

/**
 * Whether the bytes start like a PDF ("%PDF-" in their first 1024 bytes).
 *
 * @param {Buffer} bytes
 * @returns {boolean}
 */
export function looksLikePdf(bytes) {
  const index = bytes.subarray(0, MAGIC_WITHIN + MAGIC.length).indexOf(MAGIC)
  return index >= 0 && index <= MAGIC_WITHIN
}

/**
 * The PDF without its active content (see above), rewritten by pdf-lib, and
 * what was taken out ({ javascript, actions, openActions, embeddedFiles,
 * forms }, counts).
 *
 * @param {Buffer} bytes - The uploaded file.
 * @returns {Promise<{bytes: Uint8Array, pages: number, removed: Record<string, number>}>}
 * @throws {PdfRejectedError} When it isn't a PDF, is encrypted, can't be read, or has no pages.
 */
export async function sanitizePdf(bytes) {
  if (!looksLikePdf(bytes)) throw new PdfRejectedError('notPdf')
  const pdfLib = await import('pdf-lib')
  const { PDFDocument } = pdfLib

  let pdf
  let pages
  try {
    // updateMetadata: its own title, author and dates kept.
    pdf = await PDFDocument.load(bytes, { updateMetadata: false })
    pages = pdf.getPageCount()
  } catch (error) {
    throw new PdfRejectedError(error?.name === 'EncryptedPDFError' ? 'encrypted' : 'unreadable', error)
  }
  if (pages === 0) throw new PdfRejectedError('noPages')

  // No form rebuilt (updateFieldAppearances would make one), no blank page added.
  try {
    const removed = stripActiveContent(pdf, pdfLib)
    return { bytes: await pdf.save({ updateFieldAppearances: false, addDefaultPage: false }), pages, removed }
  } catch (error) {
    throw new PdfRejectedError('unreadable', error)
  }
}

// Takes the active content out of the loaded PDF (see above), in place: what
// was removed, counted.
function stripActiveContent(pdf, { PDFArray, PDFDict, PDFName, PDFStream }) {
  const removed = { javascript: 0, actions: 0, openActions: 0, embeddedFiles: 0, forms: 0 }
  const name = (value) => PDFName.of(value)
  const isRisky = (dict) => {
    const kind = dict.get(name('S'))
    return kind instanceof PDFName && RISKY_ACTIONS.some((action) => kind === name(action))
  }

  // The catalog's own: what runs as the file opens, its forms, its document
  // scripts and attachments (the /Names tree's entries).
  const { catalog } = pdf
  for (const key of ['OpenAction', 'AA']) {
    if (catalog.has(name(key))) {
      catalog.delete(name(key))
      removed.openActions++
    }
  }
  for (const key of ['AcroForm', 'XFA']) {
    if (catalog.has(name(key))) {
      catalog.delete(name(key))
      removed.forms++
    }
  }
  const names = catalog.lookupMaybe(name('Names'), PDFDict)
  if (names?.has(name('JavaScript'))) {
    names.delete(name('JavaScript'))
    removed.javascript++
  }
  if (names?.has(name('EmbeddedFiles'))) {
    names.delete(name('EmbeddedFiles'))
    removed.embeddedFiles++
  }

  // Everywhere else (pages, annotations, outlines, nested actions): each
  // object read once, its direct dictionaries and arrays walked too.
  const clean = (dict) => {
    if (dict.has(name('AA'))) {
      dict.delete(name('AA'))
      removed.actions++
    }
    if (dict.has(name('JS'))) {
      dict.delete(name('JS'))
      removed.javascript++
    }
    // An annotation's attached file.
    if (dict.get(name('Subtype')) === name('FileAttachment') && dict.has(name('FS'))) {
      dict.delete(name('FS'))
      removed.embeddedFiles++
    }
    // An action that runs or sends something: emptied, so it does nothing.
    if (isRisky(dict)) {
      for (const key of dict.keys()) if (key !== name('Type')) dict.delete(key)
      removed.actions++
    }
    // An annotation's or an outline item's action, given inline.
    for (const key of ['A', 'Next']) {
      const value = dict.get(name(key))
      if (value instanceof PDFDict && isRisky(value)) {
        dict.delete(name(key))
        removed.actions++
      }
    }
  }
  const walk = (object, depth = 0) => {
    // Deep nesting is no PDF's: a crafted file's, left alone.
    if (depth > 32) return
    if (object instanceof PDFStream) return walk(object.dict, depth + 1)
    if (object instanceof PDFDict) {
      clean(object)
      for (const [, value] of object.entries()) walk(value, depth + 1)
    } else if (object instanceof PDFArray) {
      for (const value of object.asArray()) walk(value, depth + 1)
    }
  }
  for (const [ref, object] of pdf.context.enumerateIndirectObjects()) {
    // An embedded file's own stream: deleted.
    if (object instanceof PDFStream && object.dict.get(name('Type')) === name('EmbeddedFile')) {
      pdf.context.delete(ref)
      removed.embeddedFiles++
      continue
    }
    walk(object)
  }

  return removed
}
