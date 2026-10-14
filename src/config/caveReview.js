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

// The quick reports on a cave (What changed?), each sent to the admins as a
// /feedback report (kind 'misleading', with caveId and caveReport). Besides
// these, a report can propose a cave's access, accessibility or fees - a key
// of its table (REPORTED_FIELDS): "access:permission", "accessibility:jungle",
// "fees:no". closed, private and fees: older reports (before 2026-10), still
// shown.
export const CAVE_REPORT_KINDS = ['closed', 'private', 'fees', 'road']

// The cave fields a report proposes a value for, each with its table (the
// `accesses` / `accessibilities` collections: the keys; fees: yes or no, the
// cave's true or false; their names, texts and icons from the translation
// files and components/accessIcons.jsx). An admin applies it from the
// report's page (/feedback/:id).
export const REPORTED_FIELDS = { access: 'accesses', accessibility: 'accessibilities', fees: 'fees' }

/**
 * A report's proposed value ("access:permission", "fees:no"), or null for
 * another kind: its field, its table, its key and the value the cave stores
 * (the key; fees: true or false).
 *
 * @param {string} [kind] - A report's caveReport.
 * @returns {{field: 'access'|'accessibility'|'fees', table: 'accesses'|'accessibilities'|'fees', value: string, stored: string|boolean}|null}
 */
export function reportedValue(kind) {
  const [field, value] = String(kind || '').split(':')
  if (!value || !REPORTED_FIELDS[field]) return null
  if (field === 'fees' && value !== 'yes' && value !== 'no') return null
  return { field: /** @type {'access'|'accessibility'|'fees'} */ (field), table: REPORTED_FIELDS[field], value, stored: field === 'fees' ? value === 'yes' : value }
}

/**
 * The values a cave's Access card proposes (What changed?): every other
 * access and accessibility of their tables, and the other fees - both when
 * they're unknown.
 *
 * @param {Cave} cave
 * @param {{id: string}[]} [accesses] - The accesses table.
 * @param {{id: string}[]} [accessibilities] - The accessibilities table.
 * @returns {string[]} Report kinds ("access:permission"...).
 */
export function accessProposals(cave, accesses = [], accessibilities = []) {
  return [
    ...accesses.filter(({ id }) => id !== cave.access).map(({ id }) => `access:${id}`),
    ...accessibilities.filter(({ id }) => id !== cave.accessibility).map(({ id }) => `accessibility:${id}`),
    ...(cave.fees === true ? ['fees:no'] : cave.fees === false ? ['fees:yes'] : ['fees:no', 'fees:yes']),
  ]
}

// Each section's own quick reports, offered under it (What changed?, its
// card's Still accurate arrow) - the Access card's are proposed values
// ({@link accessProposals}), not listed here. And the section's anchor on
// the cave's page.
export const SECTION_REPORT_KINDS = { access: [], fees: [], directions: ['road'], description: [] }
export const SECTION_ANCHORS = { access: 'access', fees: 'access', directions: 'getting-there', description: 'description' }

// The reports that show a public warning on the cave at once, until an
// admin resolves them (_caveReports, kept by the server's
// onCaveReportChanged; functions/js/constants.js' CAVE_WARNING_REPORTS):
// the others only reach the admins.
export const CAVE_WARNING_REPORTS = ['closed', 'private', 'access:no', 'access:permission']

// A quick report's optional note, at most.
export const CAVE_REPORT_NOTE_MAX_LENGTH = 1000
