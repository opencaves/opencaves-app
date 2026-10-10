export const REGION = 'northamerica-northeast1'

// The site: its address (links in emails, canonical URLs, the sitemap), its
// title, and its source code. The app's src/config/app.js repeats them.
export const SITE_URL = 'https://opencaves.org'
export const APP_TITLE = 'OpenCaves'
export const GITHUB_URL = 'https://github.com/opencaves/opencaves-app'

// Firestore database constants
export const CAVES_COLL_NAME = 'caves'
export const CAVES_ASSETS_COLL_NAME = 'cavesAssets'
// A photo's uploader and original file name, apart from its public record.
export const CAVES_ASSETS_PRIVATE_COLL_NAME = '_cavesAssetsPrivate'
export const USERS_COLL_NAME = '_users'
// Frozen accounts (setUserFrozen), checked by the security rules.
export const FROZEN_USERS_COLL_NAME = '_frozenUsers'
export const RATINGS_COLL_NAME = 'ratings'
// Each cave's ratings summary (average, count), public.
export const CAVE_RATINGS_COLL_NAME = '_caveRatings'
// The beta testers' reports (Send feedback): admins only, emailed to them.
export const FEEDBACK_COLL_NAME = '_feedback'
// A report's thread: the team's replies (from the app, emailed to its
// author by onFeedbackReplied) and, later, its author's answers by email.
export const FEEDBACK_MESSAGES_COLL_NAME = 'messages'
// The address a report's author answers the team's replies to (reply_to):
// the team's inbox, read by the admins, until inbound email exists (a signed
// per-thread address on reply.opencaves.org, whose answers join the thread).
// null: the emails don't invite an answer by email.
export const FEEDBACK_REPLY_TO = 'feedback@opencaves.org'

// Storage constants
export const BUCKET_NAME = 'opencaves.appspot.com'
export const THUMBNAILS_FOLDER = 'thumbnails'
// A panorama's small copies, which can show a view taken in the viewer
// instead of the whole flattened sphere (setViewThumbnail).
export const VIEW_THUMBNAIL_SIZES = ['coverImage', 'resultThumbnail', 'mediaThumbnail']

// The callable functions refuse calls without a valid App Check token (see
// docs/app-check.md). Turn on only once the app sends tokens (its reCAPTCHA
// site key set and deployed) and App Check's metrics show nearly all calls
// verified - before that, it locks the app out.
export const ENFORCE_APP_CHECK = false
