import { dashedId } from '@/services/data-service/types.js'

// Per-collection shape: which fields the form shows, and how the document ID
// is derived (a slug of one of the fields, the record's own value for one of
// its fields, or an opaque generated ID when nothing suitable exists).
// Display names live in the locale files under
// `dashboard.collections.<collectionName>`, not here.
// `descriptionsField` marks a field that is actually backed by a
// `descriptions: [{ lang, description }]` array (only English is ever
// populated from the Google Sheet) - the edit form only edits the entry for
// the admin's current UI language, leaving other languages untouched.
// `adminOnly`: edited by admins only (pages, dashboard entry and
// firestore.rules); editors still add a colour from a system's colour picker.
export const REFERENCE_DATA_CONFIGS = {
  accesses: { fields: ['name', 'description', 'note'], descriptionsField: 'description', id: { from: 'name', transform: dashedId } },
  accessibilities: { fields: ['name', 'description', 'note'], descriptionsField: 'description', id: { from: 'name', transform: dashedId } },
  sources: { fields: ['name', 'description', 'note'], id: { kind: 'generated' } },
  areas: { fields: ['name', 'note'], id: { from: 'name', transform: (v) => v } },
  colors: { fields: ['hex'], id: { kind: 'generated' }, adminOnly: true },
  languages: { fields: ['code', 'eng', 'fra'], id: { from: 'code', transform: (v) => v }, adminOnly: true },
}
