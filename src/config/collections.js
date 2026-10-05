// Firestore collections the app itself manages (accounts, settings), apart
// from the cave data: prefixed "_", so they're grouped in the Firebase
// console. The cave data's collections are named without one.
export const USERS_COLLECTION = '_users'
export const SETTINGS_COLLECTION = '_settings'
export const CAVE_RATINGS_COLLECTION = '_caveRatings'
