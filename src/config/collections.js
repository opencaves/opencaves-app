// Firestore collections the app itself manages (accounts, settings), apart
// from the cave data: prefixed "_", so they're grouped in the Firebase
// console. The cave data's collections are named without one.
export const USERS_COLLECTION = '_users'
export const SETTINGS_COLLECTION = '_settings'
export const CAVE_RATINGS_COLLECTION = '_caveRatings'

// Who changed or deleted what (written by the server's audit trigger, read
// by admins on the Audits page).
export const AUDIT_LOG_COLLECTION = '_auditLog'

// The beta testers' reports (the Send feedback form): written by their
// author, read and closed by admins (the Feedback page), emailed to them.
export const FEEDBACK_COLLECTION = '_feedback'
