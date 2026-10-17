// The records the functions read and write, as they use them: JSDoc types
// only, nothing at run time, and never imported. A script, not a module (no
// import or export): its @typedefs are global, so any file's JSDoc names them
// bare - {FeedbackReport} - wherever functions/js/jsconfig.json includes this
// file. The app's own, fuller types are in src/types.js (not shared: the
// functions are a project of their own).

/**
 * A Firestore time (firebase-admin).
 *
 * @typedef {import('firebase-admin/firestore').Timestamp} Timestamp
 */

/**
 * A cave's or a system's share image (og:image), written by share/shareImages.js.
 *
 * @typedef {object} ShareImage
 * @property {'photo'|'map'} kind - Its cover photo cropped, or its map card.
 * @property {string} url - Its public address in Storage (share/<caves|sistemas>/<id>/<key>.jpg).
 * @property {number} width
 * @property {number} height
 * @property {string} key - A hash of what it shows (shareImageKey).
 */

/**
 * Where the share images read the records around one (share/shareImages.js'
 * firestoreLookup, memoryLookup).
 *
 * @typedef {object} ShareLookup
 * @property {(sistemaId: string) => Promise<string[]>} ancestors - The systems it joined, upward, itself first.
 * @property {(sistemaId: string) => Promise<string[]>} descendants - The systems that joined it, every level, itself first.
 * @property {(id: string) => Promise<Sistema|null>} sistema
 * @property {(sistemaIds: string[]) => Promise<Cave[]>} cavesOf - The caves of these systems, with their id.
 * @property {(caveId: string) => Promise<object|null>} cover - Its cover photo outside the trash (cavesAssets), with its id.
 */

/**
 * A cave (`caves`), as the server-rendered pages and the share images read it.
 *
 * @typedef {object} Cave
 * @property {string} id
 * @property {{value: string, languageCode?: string}|null} [name] - Null for an unnamed cave.
 * @property {string[]} [aka]
 * @property {string} [area] - Its area's name.
 * @property {string} [description] - Markdown.
 * @property {string} [direction] - Markdown: getting there.
 * @property {{latitude: number, longitude: number, validity?: string}} [location] - validity 'valid': confirmed.
 * @property {string} [sistemaId]
 * @property {string[]} [photoOrder] - Its photos' order after the cover (cavesAssets ids; assets/photoOrder.js).
 * @property {string[]} [videos] - Video URLs, in the order shown.
 * @property {Record<string, string>} [reviewed] - The month ('YYYY-MM') each section (access, directions, fees,
 *   description) was last confirmed still accurate, by editors from the app.
 * @property {ShareImage} [shareImage] - Its share image (share/shareImages.js).
 */

/**
 * A cave system (`sistemas`), as the share images read it.
 *
 * @typedef {object} Sistema
 * @property {string} [name]
 * @property {string} [area]
 * @property {string} [color] - "#rrggbb".
 * @property {{latitude: number, longitude: number}} [location]
 * @property {ShareImage} [shareImage] - Its share image (share/shareImages.js).
 */

/**
 * A survey map's record (`maps`), as its files' paths need it (maps/files.js).
 *
 * @typedef {object} CaveMap
 * @property {string} [name]
 * @property {string} [date] - A partial date ("2012-10").
 * @property {string} [url] - The uploaded file's download link.
 * @property {string} [previewUrl]
 * @property {string[]} [svgIds] - A PDF's pages' ids in Storage (maps/{svgId}).
 * @property {string} [importKey] - Added by the bulk import (scripts/maps-import), not in the app.
 * @property {string} [contentHash] - The uploaded file's SHA-256 (hex), sent by the app (scripts/map-content-hashes.js for older maps).
 * @property {string} [visualHash] - Server: its thumbnail's 64-bit difference hash, 16 hex digits (maps/visualHash.js).
 * @property {string} [layerSkipReason] - Marked "not for the cave layer" by an admin: why.
 * @property {Timestamp} [deletedAt] - In the trash.
 */

/**
 * A map of the cave layer, as the tiles build publishes it (tasks/layerMaps.js).
 *
 * @typedef {object} LayerMap
 * @property {string} [mapId] - Its "maps" document, for a map added in the app.
 * @property {string} [mapImportKey] - Its "maps" document's importKey, for the bulk import's.
 * @property {string} [sistemaId]
 * @property {string} [date] - Its survey's partial date.
 * @property {string} title
 */

/**
 * An admins' task (`_tasks`, the /tasks page): written by the server, its
 * status changed by admins. Every kind has these fields; each kind adds its own.
 *
 * @typedef {object} Task
 * @property {'map'} kind
 * @property {'open'|'done'|'dismissed'} status
 * @property {Timestamp} createdAt
 * @property {Timestamp} [updatedAt] - Server: its findings last changed.
 * @property {string|null} addedBy - Who caused it (an account's id; null: a script).
 * @property {Timestamp} [closedAt]
 * @property {string} [closedBy] - An admin's account id, or 'system' when the server closed it.
 * @property {'inLayer'|'skipped'|'trashed'|'deleted'} [closedReason] - Closed by the server: why.
 * @property {Timestamp} [notifiedAt] - When the admins were emailed about it.
 */

/**
 * A survey map's task (tasks/mapTasks.js): its id is map-<mapId>.
 *
 * @typedef {object} MapTaskFields
 * @property {string} mapId
 * @property {string[]} sistemaIds - The systems listing the map.
 * @property {'exactDuplicate'|'possibleDuplicate'|'newerSurvey'|'alreadyTraced'|'newToLayer'} scenario - What the checks found, the most urgent.
 * @property {'newerSurvey'|'alreadyTraced'|'newToLayer'} layerStatus - Its systems in the cave layer.
 * @property {string[]} duplicates - Older maps that are the same (identical, then look-alikes).
 * @property {string[]} exactDuplicates - Those of them with the same file (contentHash).
 * @property {{title: string, date?: string}[]} [tracedMaps] - Its systems' maps in the cave layer.
 */

/**
 * @typedef {Task & MapTaskFields} MapTask
 */

/**
 * A Further reading item (`documents`), as the server checks and lists it
 * (documents/, whatsNew/).
 *
 * @typedef {object} CaveDocument
 * @property {'file'|'link'} kind
 * @property {string} [title]
 * @property {string} [url]
 * @property {string} [userId] - Who added it.
 * @property {string} [fullPath] - A file: documents/{id}.pdf.
 * @property {'checking'|'ready'|'rejected'} [status] - A file: checked (onDocumentUploaded), shown, or refused.
 * @property {string} [rejectReason]
 * @property {number} [size] - A file: its size once cleaned, in bytes.
 * @property {boolean} [summaryAi] - Its summary started as an AI draft (documents/draftSummary.js).
 * @property {string} [coverUrl] - A file: its first page's picture (documents/{id}_cover.webp), drawn by the server.
 * @property {Timestamp} [deletedAt] - In the trash.
 */

/**
 * A feedback report (`_feedback`), read by every registered account: nothing
 * private on it (see {@link FeedbackPrivate}).
 *
 * @typedef {object} FeedbackReport
 * @property {'bug'|'misleading'|'idea'} kind
 * @property {string} message
 * @property {string} page - The page it's about.
 * @property {string} [browser] - Older reports only, where a one-time script (2026-10-10) didn't move it to {@link FeedbackPrivate}.
 * @property {string} [language] - The app language it was sent in.
 * @property {string} userId - Its author.
 * @property {string} [authorName] - Its author's display name (onFeedbackCreated), shown to the members; none without one.
 * @property {Timestamp} createdAt
 * @property {'new'|'confirmed'|'inProgress'|'done'|'rejected'|'duplicate'} status
 * @property {Timestamp} [statusUpdatedAt]
 * @property {string} [statusUpdatedBy] - An admin's uid, or the author's when their answer by email reopened it.
 * @property {string} [statusReplyId] - The team reply that set its stage.
 * @property {string} [note] - The admins' former note (shown as the thread's first reply).
 * @property {string} [replyToken] - Older reports only (now in {@link FeedbackPrivate}), where a one-time script (2026-10-10) didn't move it.
 * @property {boolean} [authorMuted] - The author turned the feedback emails off.
 * @property {Timestamp} [reporterEmailedAt]
 * @property {number} [messageCount]
 * @property {Timestamp} [lastMessageAt]
 * @property {string} [caveId] - A cave's quick report: the cave.
 * @property {string} [caveReport] - A cave's quick report: what changed ('fees', 'road'; a proposed value, 'access:<key>', 'accessibility:<key>', 'fees:yes' or 'fees:no'; older: 'closed', 'private'); closed and
 *   private show a warning on the cave ({@link CaveReports}).
 */

/**
 * A cave's open "closed" and "now private" reports (`_caveReports/{caveId}`),
 * public, kept by onCaveReportChanged.
 *
 * @typedef {object} CaveReports
 * @property {{kind: string, at: Timestamp|null, feedbackId: string}[]} reports - Oldest first.
 */

/**
 * What of a report only admins read (`_feedbackPrivate/{id}`, the report's id).
 *
 * @typedef {object} FeedbackPrivate
 * @property {string} [browser] - Its author's user agent, written with the report.
 * @property {string} [replyToken] - Its reply address' local part (feedback/replyAddress.js).
 */

/**
 * A message in a report's thread (`_feedback/{id}/messages`).
 *
 * @typedef {object} FeedbackMessage
 * @property {string|null} [id] - Null for the report's former note.
 * @property {'team'|'author'} from
 * @property {string} text - Markdown.
 * @property {Timestamp|null} createdAt
 * @property {string} [userId]
 * @property {'app'|'email'} [via]
 * @property {'done'|'rejected'} [status] - The stage the reply closed the report with.
 * @property {Timestamp} [emailedAt]
 * @property {string} [emailMessageId] - An answer by email: its Message-ID.
 * @property {number} [droppedAttachments]
 * @property {boolean} [legacy] - The report's former note, shown as a reply.
 */

/**
 * A received email, as Resend's API gives it (feedback/feedbackInbound.js) -
 * the fields read.
 *
 * @typedef {object} ReceivedEmail
 * @property {string} [from]
 * @property {string|string[]} [to]
 * @property {string|string[]} [cc]
 * @property {string|string[]} [received_for]
 * @property {string} [text]
 * @property {string} [html]
 * @property {Array<{name: string, value: string}>|Record<string, string|string[]>} [headers]
 * @property {{dkim?: string, dmarc?: string, spf?: string}} [authentication] - The receiving server's checks
 *   ('pass', 'fail', 'gray'...).
 * @property {string} [message_id]
 * @property {unknown[]} [attachments]
 */

/**
 * An item of the What's new page (getWhatsNew): a record added, modified or
 * removed, or a cave's photos or videos added (one per cave, author and day).
 *
 * @typedef {object} WhatsNewItem
 * @property {'added'|'modified'|'removed'} change - Photos and videos are always added.
 * @property {'caves'|'sistemas'|'connections'|'maps'|'documents'|'photos'|'videos'} kind
 * @property {string} docId - The record's id (photos, videos: an id of the group).
 * @property {string|null} [name] - Its current name (removed: its last).
 * @property {string|null} [sistemaId] - A cave's system, a connection's joining system.
 * @property {string|null} [parentSistemaId] - A connection's other system.
 * @property {string|null} [thumbnailUrl] - A map's thumbnail (never for a removed one).
 * @property {string[]} [fields] - Modified: the fields changed that day, by their stored names.
 * @property {string} [caveId] - Photos, videos: their cave.
 * @property {number} [count] - Photos, videos: how many.
 * @property {Array<object|string>} [media] - Photos ({ id, thumbnailRevision, viewThumbnailRevision }) or video URLs: the first few.
 * @property {string|null} at - ISO date of the change (a group's latest).
 * @property {string|null} authorName - Its author's display name.
 */

/**
 * How popular the records of a kind are (`_popularity/caves`,
 * `_popularity/sistemas`; refreshPopularity): public, by record id.
 *
 * @typedef {object} Popularity
 * @property {Record<string, number>} views - Its pages' views in Google Analytics, the last 90 days (a
 *   cave: /caves/<id> and /map/<id>; a system: /sistemas/<id>).
 * @property {Record<string, number>} [saves] - Caves: how many accounts saved it.
 * @property {Timestamp} updatedAt
 */
