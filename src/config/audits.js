// The Audits page (routes/audits) and the server's undo/trash callables.

// Changes loaded at a time (the list's "Load more").
export const AUDIT_PAGE_SIZE = 50

// Most ids/items one undoAuditEntries or emptyTrash call takes (the server's
// limit): longer lists are sent in chunks of this size.
export const AUDIT_BATCH_LIMIT = 500

// authorId of the changes made through the local emulators (no account).
export const EMULATOR_AUTHOR_ID = 'emulator'
