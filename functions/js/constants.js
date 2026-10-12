export const REGION = 'northamerica-northeast1'

// The site: its address (links in emails, canonical URLs, the sitemap), its
// title, and its source code. The app's src/config/app.js repeats them.
export const SITE_URL = 'https://opencaves.org'
export const APP_TITLE = 'OpenCaves'
// The name ending the pages' <title> ("Caves / Open Caves"), in two words:
// people search "open caves". The one setting: the app imports it too
// (src/config/app.js), so keep this file free of imports.
export const TITLE_NAME = 'Open Caves'
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
// The errors the app's "Something went wrong" page showed (written by the
// browser, src/utils/errorReports.js; read by admins).
export const ERROR_REPORTS_COLL_NAME = '_errorReports'
// What's new, built by the server (refreshWhatsNew) into one public document
// the page reads.
export const WHATS_NEW_COLL_NAME = '_whatsNew'
export const WHATS_NEW_DOC_ID = 'latest'
// How popular the caves and the cave systems are (their pages' views, how
// many saved a cave), built by the server (refreshPopularity) into one
// public document per kind, _popularity/caves and _popularity/sistemas: for
// the search fields' suggestions (the most visited first; to come).
export const POPULARITY_COLL_NAME = '_popularity'
// The caves an account saved (_users/{uid}/savedCaves/{caveId}).
export const SAVED_CAVES_COLL_NAME = 'savedCaves'
// The members' reports (Send feedback): read by every registered
// account (Ideas and fixes), managed by admins, emailed to them.
export const FEEDBACK_COLL_NAME = '_feedback'
// What of a report only admins read (its browser, its reply token), apart
// from the report the members read.
export const FEEDBACK_PRIVATE_COLL_NAME = '_feedbackPrivate'
// Each cave's open "closed" and "now private" quick reports (a report's
// caveId and caveReport), public: the warnings shown on the cave, kept by
// onCaveReportChanged - { reports: [{ kind, at, feedbackId }] }.
export const CAVE_REPORTS_COLL_NAME = '_caveReports'
// The quick reports that show a warning (src/config/caveReview.js'
// CAVE_WARNING_REPORTS): "Fees changed" and "Road changed" only reach the
// admins.
export const CAVE_WARNING_REPORTS = ['closed', 'private']
// A report's stages while it's open (src/utils/feedback.js'
// OPEN_FEEDBACK_STATUSES): done, rejected or duplicate resolve it.
export const OPEN_FEEDBACK_STATUSES = ['new', 'confirmed', 'inProgress']
// A report's thread: the team's replies (from the app, emailed to its
// author by onFeedbackReplied) and its author's answers by email
// (feedbackInbound).
export const FEEDBACK_MESSAGES_COLL_NAME = 'messages'
// Where a report's author answers the team's replies (the emails' reply_to).
// FEEDBACK_REPLY_DOMAIN set: each report's own address on that domain,
// <replyToken>@<domain> (a random token kept in its _feedbackPrivate doc), whose mail
// Resend receives and hands to feedbackInbound - the answer joins the
// report's thread. Needs the domain's receiving set up in Resend (MX at
// Porkbun) and the webhook: see docs/maintenance.md, "Emails". null: the
// answers go to FEEDBACK_REPLY_TO, the team's inbox (a Porkbun forward to the
// admin), read by hand; both null: the emails don't invite an answer.
export const FEEDBACK_REPLY_DOMAIN = 'reply.opencaves.org'
export const FEEDBACK_REPLY_TO = 'feedback@opencaves.org'
// A thread message's longest text (src/utils/feedback.js'
// FEEDBACK_REPLY_MAX_LENGTH, firestore.rules): an emailed answer is cut there.
export const FEEDBACK_REPLY_MAX_LENGTH = 10000

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
