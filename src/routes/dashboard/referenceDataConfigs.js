import { dashedId } from '@/services/data-service/types.js'

// Per-collection shape: which fields the form shows, and how the document ID
// is derived (a slug of one of the fields, the record's own value for one of
// its fields, or an opaque generated ID when nothing suitable exists).
// `descriptionsField` marks a field that is actually backed by a
// `descriptions: [{ lang, description }]` array (only English is ever
// populated from the Google Sheet) - the edit form only edits the entry for
// the admin's current UI language, leaving other languages untouched.
export const REFERENCE_DATA_CONFIGS = {
  accesses: { label: 'Accesses', fields: ['name', 'description', 'note'], descriptionsField: 'description', id: { from: 'name', transform: dashedId } },
  accessibilities: { label: 'Accessibilities', fields: ['name', 'description', 'note'], descriptionsField: 'description', id: { from: 'name', transform: dashedId } },
  sources: { label: 'Sources', fields: ['name', 'description', 'note'], id: { kind: 'generated' } },
  areas: { label: 'Areas', fields: ['name', 'note'], id: { from: 'name', transform: (v) => v } },
  colors: { label: 'Colors', fields: ['hex'], id: { kind: 'generated' } },
  languages: { label: 'Languages', fields: ['code', 'eng', 'fra'], id: { from: 'code', transform: (v) => v } },
}
