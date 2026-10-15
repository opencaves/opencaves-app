// Further reading (`documents`): papers, survey reports, articles, books and
// web pages about caves and cave systems - an uploaded PDF or a link. The
// limits are firestore.rules' and storage.rules' too (and the server's,
// functions/js/documents/): keep them the same there.

// A PDF's largest size (storage.rules).
export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024
export const DOCUMENT_CONTENT_TYPE = 'application/pdf'

// The fields' longest values (firestore.rules' isValidDocument).
export const DOCUMENT_TITLE_MAX = 500
export const DOCUMENT_PUBLISHER_MAX = 300
export const DOCUMENT_DESCRIPTION_MAX = 1000
export const DOCUMENT_URL_MAX = 2000
export const DOCUMENT_AUTHORS_MAX = 50

// A DOI, as found in a PDF's text or a link (case-insensitive): Crossref's
// recommended pattern.
export const DOI_PATTERN = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i

// Crossref's API, which answers a DOI with its work's details (CORS allowed).
export const CROSSREF_WORKS_URL = 'https://api.crossref.org/works/'

// How many of a PDF's first pages are read for its title and DOI.
export const DOCUMENT_PAGES_READ = 2
