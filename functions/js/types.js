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
 * A cave (`caves`), as the server-rendered pages read it (seo/).
 *
 * @typedef {object} Cave
 * @property {string} id
 * @property {{value: string, languageCode?: string}|null} [name] - Null for an unnamed cave.
 * @property {string[]} [aka]
 * @property {string} [area] - Its area's name.
 * @property {string} [description] - Markdown.
 * @property {string} [direction] - Markdown: getting there.
 * @property {{latitude: number, longitude: number}} [location]
 * @property {string} [sistemaId]
 */

/**
 * A survey map's record (`maps`), as its files' paths need it (maps/files.js).
 *
 * @typedef {object} CaveMap
 * @property {string} [url] - The uploaded file's download link.
 * @property {string[]} [svgIds] - A PDF's pages' ids in Storage (maps/{svgId}).
 */

/**
 * A feedback report (`_feedback`).
 *
 * @typedef {object} FeedbackReport
 * @property {'bug'|'misleading'|'idea'} kind
 * @property {string} message
 * @property {string} page - The page it's about.
 * @property {string} [browser]
 * @property {string} [language] - The app language it was sent in.
 * @property {string} userId - Its author.
 * @property {Timestamp} createdAt
 * @property {'new'|'confirmed'|'inProgress'|'done'|'rejected'|'duplicate'} status
 * @property {Timestamp} [statusUpdatedAt]
 * @property {string} [statusUpdatedBy] - An admin's uid, or the author's when their answer by email reopened it.
 * @property {string} [statusReplyId] - The team reply that set its stage.
 * @property {string} [note] - The admins' former note (shown as the thread's first reply).
 * @property {string} [replyToken] - Its reply address' local part (feedback/replyAddress.js).
 * @property {boolean} [authorMuted] - The author turned the feedback emails off.
 * @property {Timestamp} [reporterEmailedAt]
 * @property {number} [messageCount]
 * @property {Timestamp} [lastMessageAt]
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
