export const REGION = 'northamerica-northeast1'

// Firestore database constants
export const CAVES_COLL_NAME = 'caves'
export const CAVES_ASSETS_COLL_NAME = 'cavesAssets'
// A photo's uploader and original file name, apart from its public record.
export const CAVES_ASSETS_PRIVATE_COLL_NAME = 'cavesAssetsPrivate'
export const USERS_COLL_NAME = 'users'
export const RATINGS_COLL_NAME = 'ratings'

// Storage constants
export const BUCKET_NAME = 'opencaves.appspot.com'
export const THUMBNAILS_FOLDER = 'thumbnails'

// The callable functions refuse calls without a valid App Check token (see
// docs/app-check.md). Turn on only once the app sends tokens (its reCAPTCHA
// site key set and deployed) and App Check's metrics show nearly all calls
// verified - before that, it locks the app out.
export const ENFORCE_APP_CHECK = false
