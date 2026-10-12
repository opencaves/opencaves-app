// Firestore collections the app itself manages (accounts, settings), apart
// from the cave data: prefixed "_", so they're grouped in the Firebase
// console. The cave data's collections are named without one.
export const USERS_COLLECTION = '_users'
export const SETTINGS_COLLECTION = '_settings'
export const CAVE_RATINGS_COLLECTION = '_caveRatings'

// The errors the "Something went wrong" page showed (src/utils/errorReports.js):
// created by anyone, read by admins, deleted after 90 days (expireAt's TTL).
export const ERROR_REPORTS_COLLECTION = '_errorReports'

// What's new, built by the server (refreshWhatsNew) into one public document
// the page reads: { items, builtAt }.
export const WHATS_NEW_COLLECTION = '_whatsNew'
export const WHATS_NEW_DOC_ID = 'latest'

// How popular the caves and the cave systems are, built nightly by the
// server (refreshPopularity) into one public document per kind, by id:
// _popularity/caves { views, saves, updatedAt } - their pages' views
// (Google Analytics) and how many accounts saved them - and
// _popularity/sistemas { views, updatedAt }. The caves' list ranked by
// usefulness reads the caves' (src/utils/caveRank.js).
export const POPULARITY_COLLECTION = '_popularity'

// Who changed or deleted what (written by the server's audit trigger, read
// by admins on the Audits page).
export const AUDIT_LOG_COLLECTION = '_auditLog'

// The members' reports (the Send feedback form): written by their
// author, read by every registered account (Ideas and fixes), closed by
// admins (the Feedback page), emailed to them.
export const FEEDBACK_COLLECTION = '_feedback'
// What of a report only admins read (its browser, the server's reply token),
// written with the report, in the same batch.
export const FEEDBACK_PRIVATE_COLLECTION = '_feedbackPrivate'
// A report's thread (_feedback/{id}/messages): the team's replies, emailed to
// its author (onFeedbackReplied).
export const FEEDBACK_MESSAGES_COLLECTION = 'messages'
