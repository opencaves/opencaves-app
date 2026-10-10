// The app's core records, as the code reads and writes them: JSDoc types
// only, nothing at run time, and never imported. A script, not a module (no
// import or export): its @typedefs are global, so any file's JSDoc names them
// bare - {Cave}, {FeedbackReport} - wherever jsconfig.json includes this file
// (VS Code, TypeScript's checks). firestore.rules lists the fields an edit
// from the app may set; the server's own shapes are in functions/js/types.js.

/**
 * A Firestore time: a Timestamp, or its plain JSON ({ seconds, nanoseconds })
 * in the data of a page the server rendered (ssr/ssrContext.js).
 *
 * @typedef {import('firebase/firestore').Timestamp | {seconds: number, nanoseconds: number}} Timestamp
 */

/**
 * A point on the ground (a cave's location, entrance, parking, key).
 *
 * @typedef {object} GeoPoint
 * @property {number} latitude
 * @property {number} longitude
 * @property {'valid'|'invalid'|'unknown'|string} [validity] - Whether the coordinates were checked.
 */

/**
 * A cave's name, in the language it's written in.
 *
 * @typedef {object} LocalizedName
 * @property {string} value
 * @property {string} [languageCode] - Its content language (ISO 639-2: eng, spa, myn...).
 */

/**
 * A Markdown field's source: the `sources` record, and when it was checked
 * ("2026-10").
 *
 * @typedef {object} TextSource
 * @property {string|null} [source]
 * @property {string} [checkedAt]
 */

/**
 * One of a system's sistema ancestry links, computed client-side at read
 * time (postProcessCaveData.js) from `connections`, never stored.
 *
 * @typedef {object} SistemaAncestor
 * @property {string} id
 * @property {string} name - 'n. d.' when the system has no record.
 * @property {string} color - The system's colour (the default one when it has none).
 * @property {string} [date] - When it was connected into its parent (a parent's link only).
 * @property {boolean} [u]
 */

/**
 * A cave (`caves`): one record per cave, its entrance usually a cenote.
 *
 * @typedef {object} Cave
 * @property {string} id
 * @property {LocalizedName|null} [name] - Null for an unnamed cave.
 * @property {Record<string, string[]>} [nameTranslations] - Its other names, by content language code.
 * @property {string[]} [aka] - Other names it goes by.
 * @property {GeoPoint} [location]
 * @property {GeoPoint} [entrance]
 * @property {GeoPoint} [parking]
 * @property {GeoPoint[]} [keys] - Where its key is kept.
 * @property {string} [sistemaId] - Its own system (the direct one: its ancestry is {@link Cave.sistemas}).
 * @property {string} [sistemaColor] - A stale copy of its system's colour; the app reads the system's own.
 * @property {string} [area] - Its area's name (also the `areas` record's id, for those from the Sheet).
 * @property {string} [source] - The `sources` record its data came from.
 * @property {string} [access] - An `accesses` record's id.
 * @property {string} [accessDetails] - Markdown.
 * @property {string} [accessibility] - An `accessibilities` record's id.
 * @property {string} [accessibilityDetails] - Markdown.
 * @property {string} [description] - Markdown.
 * @property {string} [direction] - Markdown: getting there.
 * @property {string} [note]
 * @property {string} [reporter]
 * @property {string} [explorationDate] - A partial date ("1990", "1986-07", "2004-06-14") or years ("2004-2006").
 * @property {string[]} [videos] - Video URLs (older records: one "|"-separated string).
 * @property {boolean} [cenoteEntrance] - A cenote used to enter a cave system.
 * @property {boolean} [facilities]
 * @property {boolean} [fees]
 * @property {Record<string, TextSource>} [textSources] - By Markdown field (utils/textSources.js).
 * @property {SistemaAncestor[]} [sistemas] - Derived: its system and that system's ancestors, its own first
 *   (postProcessCaveData.js, at read time).
 * @property {boolean} [located] - Derived: whether it has coordinates, in a server-rendered page's data
 *   (ssr/pageState.js), which leaves the coordinates out.
 */

/**
 * One exploration of a system (a sistema's `explorations`).
 *
 * @typedef {object} Exploration
 * @property {string} [date] - A partial date or years, as {@link Cave.explorationDate}.
 * @property {string|string[]} [team] - Its names (older records: one comma-separated string, utils/explorationTeam.js).
 * @property {string} [notes]
 * @property {string} [description] - Markdown.
 */

/**
 * A cave system (`sistemas`).
 *
 * @typedef {object} Sistema
 * @property {string} id
 * @property {string} [name]
 * @property {Record<string, string[]>} [nameTranslations] - As {@link Cave.nameTranslations}.
 * @property {string[]} [aka]
 * @property {string} [area] - The area's name, as {@link Cave.area}.
 * @property {string} [color] - "#rrggbb".
 * @property {string} [description] - Markdown.
 * @property {string} [direction] - Markdown.
 * @property {string} [note]
 * @property {string} [source]
 * @property {GeoPoint} [location]
 * @property {number} [length] - Explored length, in metres.
 * @property {number} [maxDepth] - In metres.
 * @property {boolean} [public] - False: no page of its own.
 * @property {Exploration[]} [explorations]
 * @property {string[]} [maps] - Its `maps` records' ids.
 * @property {Record<string, TextSource>} [textSources]
 */

/**
 * A system connected into a bigger one (`connections`).
 *
 * @typedef {object} Connection
 * @property {string} id
 * @property {string} [sistemaId] - The system connected.
 * @property {string} [parentSistemaId] - The one it's now part of.
 * @property {string} [connectionDate] - A partial date.
 * @property {string} [source]
 * @property {string} [reporter]
 * @property {string} [note]
 */

/**
 * An area (`areas`). Its id is its name for those from the Sheet.
 *
 * @typedef {object} Area
 * @property {string} id
 * @property {string} [name]
 * @property {string} [note]
 */

/**
 * The cave-data collections as the app reads them ({ id, ...fields } each):
 * raw from Firestore (services/data-service/firestoreDataReader.js), or
 * processed (postProcessCaveData.js: the caves' derived fields, the default
 * colour first in `colors`).
 *
 * @typedef {object} CaveData
 * @property {Cave[]} caves
 * @property {Sistema[]} sistemas
 * @property {Connection[]} connections
 * @property {object[]} accesses
 * @property {object[]} accessibilities
 * @property {object[]} sources
 * @property {Area[]} areas
 * @property {{hex: string, default?: boolean}[]} colors
 * @property {object[]} languages - The content languages ({ code, eng, fra, spa }).
 */

/**
 * The trash's mark on a photo or map: who moved it there and when.
 *
 * @typedef {object} Trashable
 * @property {Timestamp} [deletedAt]
 * @property {string|null} [deletedBy] - The admin's uid.
 */

/**
 * A photo or video record (`cavesAssets`), written by the server when its file
 * is uploaded (functions/js/assets/onUploaded.js). The app reads it as a
 * models/CaveAsset.js instance, which adds its URLs.
 *
 * @typedef {object} CaveAssetFields
 * @property {string} id
 * @property {string} caveId
 * @property {'image'|'video'|string} type
 * @property {boolean} isCover - Its cave's cover (one per cave, outside the trash).
 * @property {string} mediaType - The file's MIME type.
 * @property {string} fullPath - The original's path in Storage (caves/{caveId}/{type}s/{id}).
 * @property {Timestamp} [date] - When it was taken (its camera's), else uploaded.
 * @property {number} [width] - As shown (its EXIF orientation applied).
 * @property {number} [height]
 * @property {number} [orientation] - EXIF orientation.
 * @property {{latitude: number, longitude: number, altitude: number|null}} [position] - Its GPS (EXIF).
 * @property {boolean} [usePanoramaViewer] - A 360° photo (XMP).
 * @property {string} [projectionType]
 * @property {number} [poseHeadingDegrees]
 * @property {number} [thumbnailRevision] - Its copies redone: part of their names past 1.
 * @property {number} [viewThumbnailRevision] - A panorama's small copies made from a view (setViewThumbnail).
 * @property {{yaw: number, pitch: number, zoom: number}} [thumbnailView] - That view.
 * @property {Timestamp} [_created] - Stamped by the server (onAssetCreated).
 * @property {Timestamp} [_updated]
 */

/**
 * A photo or video record, with its trash mark.
 *
 * @typedef {CaveAssetFields & Trashable} CaveAsset
 */

/**
 * A survey map (`maps`): its file in Storage, its details from the person who
 * added it, and the copies the server derives from it
 * (functions/js/maps/onUploaded.js).
 *
 * @typedef {object} CaveMapFields
 * @property {string} id
 * @property {string} [name] - Its title.
 * @property {string[]} [authors]
 * @property {string} [date] - A partial date ("2012-10").
 * @property {string} [note]
 * @property {string} [contentType] - The uploaded file's MIME type.
 * @property {string} [url] - The uploaded file's download link.
 * @property {string} [previewUrl] - Server: the WebP view (an image), or a PDF's first page.
 * @property {string[]} [previewUrls] - Server: a PDF's pages, as SVG.
 * @property {string} [thumbnailUrl] - Server: the WebP thumbnail.
 * @property {string[]} [svgIds] - Server: a PDF's pages' ids in Storage (maps/{svgId}).
 * @property {string} [layerSkipReason] - Marked "not for the cave layer" by an admin: why.
 * @property {string} [layerSkippedBy]
 * @property {Timestamp} [layerSkippedAt]
 */

/**
 * A survey map, with its trash mark.
 *
 * @typedef {CaveMapFields & Trashable} CaveMap
 */

/**
 * A feedback report (`_feedback`), sent from the Send feedback form.
 *
 * @typedef {object} FeedbackReport
 * @property {string} id
 * @property {'bug'|'misleading'|'idea'} kind
 * @property {string} message
 * @property {string} page - The page it's about.
 * @property {string} [browser]
 * @property {string} [language] - The app language it was sent in.
 * @property {string} userId - Its author.
 * @property {Timestamp} createdAt
 * @property {'new'|'confirmed'|'inProgress'|'done'|'rejected'|'duplicate'} status - utils/feedback.js' FEEDBACK_STATUSES.
 * @property {Timestamp} [statusUpdatedAt]
 * @property {string} [statusUpdatedBy]
 * @property {string} [statusReplyId] - The team reply that set its stage.
 * @property {string} [note] - The admins' former note, only read now (shown as the thread's first reply).
 * @property {boolean} [authorMuted] - Server: the author turned the feedback emails off.
 * @property {Timestamp} [reporterEmailedAt] - Server: when a team reply was last emailed to the author.
 * @property {number} [messageCount] - Server: its thread's messages.
 * @property {Timestamp} [lastMessageAt] - Server.
 */

/**
 * A message in a report's thread (`_feedback/{id}/messages`): a team reply,
 * or the author's answer by email.
 *
 * @typedef {object} FeedbackMessage
 * @property {string} [id]
 * @property {'team'|'author'} from
 * @property {string} text - Markdown.
 * @property {Timestamp|null} createdAt
 * @property {string} [userId] - Who wrote it.
 * @property {'app'|'email'} [via]
 * @property {'done'|'rejected'} [status] - The stage the reply closed the report with.
 * @property {Timestamp} [emailedAt] - Server: when it was emailed to the author.
 * @property {string} [emailMessageId] - An answer by email: its Message-ID.
 * @property {number} [droppedAttachments] - An answer by email: its attachments, left out.
 * @property {boolean} [legacy] - The report's former note shown as a reply (no record of its own).
 */

/**
 * An account's own document (`_users/{uid}`). The person sets only their
 * settings (absent: automatic, or yes for feedbackEmails); the rest is the
 * server's.
 *
 * @typedef {object} UserSettings
 * @property {'en'|'fr'|'es'} [language] - The app (UI) language.
 * @property {'metric'|'imperial'} [units]
 * @property {'system'|'light'|'dark'} [colorMode]
 * @property {boolean} [feedbackEmails] - False: the team's replies to their feedback aren't emailed.
 * @property {string} [email] - Server: written at sign-up.
 * @property {unknown[]} [savedPlaces] - Server: written (empty) at sign-up; saved caves are in its savedCaves.
 * @property {string} [unsubscribeToken] - Server: the emails' unsubscribe link (read-only for its owner).
 */
