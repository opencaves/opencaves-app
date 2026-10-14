// "Still right?": the parts of a cave's record people confirm one at a time
// (Cave.reviewed: the month each was last confirmed, 'YYYY-MM'), in their
// order on the page. access: the access and its details; directions:
// getting there (the direction field); fees: the fees and facilities;
// description. firestore.rules (isValidCave) lists the same keys.
export const REVIEW_SECTIONS = ['access', 'directions', 'fees', 'description']

// How long a confirmation counts, in months: past it, a section reads "Last
// confirmed in <year>" and counts as not confirmed (the caves' "Not
// confirmed recently" filter).
export const REVIEW_VALID_MONTHS = 24

// The quick reports on a cave (Report a change), each sent to the admins as
// a /feedback report (kind 'misleading', with caveId and caveReport).
export const CAVE_REPORT_KINDS = ['closed', 'private', 'fees', 'road']

// Each section's own quick reports, offered under it (Report a change, next
// to its Still accurate) - the description has none: its Report a change
// opens the feedback form. And the section's anchor on the cave's page.
export const SECTION_REPORT_KINDS = { access: ['closed', 'private'], fees: ['fees'], directions: ['road'], description: [] }
export const SECTION_ANCHORS = { access: 'access', fees: 'access', directions: 'getting-there', description: 'description' }

// The reports that show a public warning on the cave at once, until an
// admin resolves them (_caveReports, kept by the server's
// onCaveReportChanged; functions/js/constants.js' CAVE_WARNING_REPORTS):
// the others only reach the admins.
export const CAVE_WARNING_REPORTS = ['closed', 'private']

// A quick report's optional note, at most.
export const CAVE_REPORT_NOTE_MAX_LENGTH = 1000
