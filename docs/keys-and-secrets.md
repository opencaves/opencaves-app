# Keys and secrets

Every key, secret, token and credential OpenCaves uses: what it is for, who
uses it, where it lives, whether it is public, and how to replace it. This
guide holds **no values** - only names and places. Never paste a value into a
file in git, a commit, an issue, a chat or a log.

## Summary

| Name | For | Used by | Lives in | Public? |
|---|---|---|---|---|
| Firebase web config (`VITE_FIREBASE_*`) | The app's link to the Firebase project | The app (browser) | `.env` | Public by design |
| Browser API key ("OpenCaves App - Browser key") | Firebase Auth and installations from the browser | The app (browser) | `.env` (`VITE_FIREBASE_API_KEY`), Google Cloud API keys | Public, restricted by URL and API |
| `VITE_MAPBOX_ACCESS_TOKEN` | The map's tiles and styles | The app (browser), map-layer scripts (fallback) | `.env`, Mapbox account | Public, restricted by URL |
| `MAPBOX_SCRIPTS_TOKEN` | The map-layer scripts' local preview pages | `scripts/map-layer/*.py` | `.env`, Mapbox account | Public token, no URL restriction - kept out of the app |
| `MAPBOX_STATIC_TOKEN` | The share images' map cards (Static Images API) | Share-image functions, `scripts/share-images.js` | Secret Manager, `functions/js/.secret.local` | Public token, no URL restriction - kept on the server |
| `GOOGLE_GEOCODING_API_KEY` | A cave's address (`/api/address/<caveId>`) | `caveAddress` function | Secret Manager, `functions/js/.secret.local`, Google Cloud API keys | Secret |
| `RESEND_API_KEY` | Sending email (send-only) | Email functions, `scripts/send-news.js` | Secret Manager, Resend account | Secret |
| `RESEND_INBOUND_KEY` | Reading received emails (full access) | `feedbackInbound` | Secret Manager, Resend account | Secret |
| `RESEND_WEBHOOK_SECRET` | Checking the inbound webhook's signature | `feedbackInbound` | Secret Manager, Resend webhook | Secret |
| `BING_WEBMASTER_API_KEY` | Submitting pages to Bing | `scripts/submit-to-search.js` | Secret Manager, Bing Webmaster Tools | Secret |
| IndexNow key | Proving the site is ours to IndexNow | `scripts/submit-to-search.js` | `public/<key>.txt`, the script | Public by design |
| `GA_PROPERTY_ID` | Which GA4 property `refreshPopularity` reads | `refreshPopularity` | `functions/js/.env` (a param) | Not secret (an id) |
| GTM container id | Loading Google Tag Manager / Analytics | The app (browser) | `src/index.jsx` | Public by design |
| `VITE_RECAPTCHA_SITE_KEY` (+ its secret) | App Check (reCAPTCHA v3) - not set yet | The app (browser), Firebase | `.env`; the secret in the Firebase console | Site key public, secret in Firebase |
| Google and Microsoft sign-in | OAuth clients for "Sign in with..." | Firebase Auth | Firebase console (Microsoft: an Azure app's client secret) | Secret (client secrets) |
| Service accounts | The functions' identity, Admin SDK, Vertex AI, GA4 | Functions, scripts | Google Cloud IAM | Credentials, no key files in use |
| Your own logins | `gcloud`, application default credentials, Firebase CLI, `gh` | You, the scripts, deploys | Your computer | Personal |

Not secrets, though they sit next to them: `VITE_APP_NAME`, `VITE_ERROR_REPORTS`,
`SYNC_ACCOUNTS` (pairs of emails, `.env`), and the emulator hosts
(`FIRESTORE_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST`...). Docker and
Playwright need no credentials.

## Where the values are kept

- **Google Secret Manager** ([console](https://console.cloud.google.com/security/secret-manager?project=opencaves)),
  project `opencaves`: `BING_WEBMASTER_API_KEY`, `GOOGLE_GEOCODING_API_KEY`,
  `MAPBOX_STATIC_TOKEN`, `RESEND_API_KEY`, `RESEND_INBOUND_KEY`,
  `RESEND_WEBHOOK_SECRET`. The functions declare theirs with `defineSecret`
  and list them in their `secrets: [...]` options; Firebase gives the functions'
  service account access to each one when it deploys them. List them (names only):

  ```
  gcloud secrets list --project opencaves --format="value(name)"
  ```

- **`.env`** at the root (git-ignored; `.env.example` lists the names, with no
  values): the app's `VITE_*` values, which Vite builds **into the app** - so
  only public values may start with `VITE_` - and the scripts' own
  (`MAPBOX_SCRIPTS_TOKEN`, `SYNC_ACCOUNTS`, and optionally `RESEND_API_KEY`,
  `MAPBOX_STATIC_TOKEN` or `BING_WEBMASTER_API_KEY` to override Secret Manager).
- **`functions/js/.env`** (git-ignored, keep it on the computer you deploy
  from): the functions' params, today `GA_PROPERTY_ID`. `functions/js/.env.local`
  is the emulators' version.
- **`functions/js/.secret.local`** (git-ignored, never committed): the
  emulators' copies of the functions' secrets - see
  [The emulators](#the-emulators).

Check which names a file defines without showing values:

```
grep -oE '^[A-Z_]+=' .env functions/js/.env functions/js/.secret.local
```

## Replacing a secret in Secret Manager

The same steps for every secret in Secret Manager. Copy the new value to the
clipboard first.

1. **Make the new key** at the provider (its section below).
2. **Add it as a new version.** In Git Bash:

   ```bash
   tr -d '\r\n' < /dev/clipboard | gcloud secrets versions add NAME --data-file=- --project opencaves
   ```

   In PowerShell, through a temporary file - **not** by piping
   `(Get-Clipboard).Trim()` into gcloud: Windows PowerShell 5.1 adds a byte
   order mark and a line break to whatever it pipes into a program, and they
   end up in the secret (the functions read their secrets as they are, so a
   key with them is refused):

   ```powershell
   $f = New-TemporaryFile; [IO.File]::WriteAllText($f, (Get-Clipboard).Trim()); gcloud secrets versions add NAME --data-file="$f" --project opencaves; Remove-Item $f
   ```

   `firebase functions:secrets:set NAME` (paste at its prompt) does the same.
3. **Redeploy the functions that read it** (listed in each section): a
   deployed function keeps the version it was deployed with until then.

   ```
   firebase deploy --only functions:js:<name>,functions:js:<other>
   ```

4. **Check** that the feature works (each section says how).
5. **Destroy the old version** - only now, or the functions still on it fail:

   ```
   gcloud secrets versions list NAME --project opencaves
   gcloud secrets versions destroy <old version number> --secret=NAME --project opencaves
   ```

6. **Revoke the old key at the provider.**

Scripts that read a secret (`send-news.js`, `share-images.js`,
`submit-to-search.js`) take the latest version with `gcloud secrets versions
access` at each run, in memory only - nothing to redeploy for them.

## If a secret leaks

A value pasted in a chat, a commit, a screenshot, a shared file:

1. **Replace it at once** (the steps above), and revoke the old key at the
   provider. A key that was in git stays in its history even after a new
   commit removes it: replace it, don't rewrite history.
2. **Check its use** in the provider's dashboard for the days since the leak:
   Mapbox's [Statistics](https://console.mapbox.com/account/statistics/),
   Resend's [Logs](https://resend.com/emails), Google Cloud's
   [APIs & Services](https://console.cloud.google.com/apis/dashboard?project=opencaves)
   metrics, Bing Webmaster Tools' quota.
3. A **public** value (Firebase web config, the app's Mapbox token, the
   IndexNow key) leaking is no event: it's in every page already. What protects
   them is their restrictions - keep those in place.

Known: `MAPBOX_STATIC_TOKEN`'s value was shown once in a chat (2026-10-17),
and was kept by choice; watch its usage in Mapbox's Statistics and replace it
if it rises without reason.

## The emulators

The emulators read the functions' secrets from `functions/js/.secret.local`
(one `NAME=value` per line; git-ignored, never committed) when they start or
reload the functions. Today it holds `GOOGLE_GEOCODING_API_KEY` and
`MAPBOX_STATIC_TOKEN`. The emails need none: in the emulators nothing is sent,
the email goes to the functions' log. To test the inbound webhook, add a test
`RESEND_WEBHOOK_SECRET` there (any Svix-style `whsec_...` secret you sign the
test request with - not production's). Params come from
`functions/js/.env.local`. The app's `VITE_*` values come from `.env`, the
same as for a build; App Check is off on `localhost`.

To fill `.secret.local` with production's value of a secret, copy it into the
file yourself (from `gcloud secrets versions access latest --secret=NAME
--project opencaves`) - never through a file in git or a chat.

## The app (public by design)

### Firebase web config (`VITE_FIREBASE_*`)

- **For:** connecting the app to the `opencaves` project:
  `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
  `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
  `VITE_FIREBASE_LOCATION`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
  `VITE_FIREBASE_APP_ID`.
- **Used by:** the app, `src/config/firebase.config.js`.
- **Lives in:** `.env`; the values come from the
  [Firebase project settings](https://console.firebase.google.com/project/opencaves/settings/general)
  (the web app's config).
- **Public:** yes. They identify the project, they don't grant access:
  Firestore and Storage are guarded by `firestore.rules` and `storage.rules`,
  the functions by their own checks, and [App Check](app-check.md) can later
  refuse anything that isn't the app.
- **Restrictions:** the API key is the Google Cloud key "OpenCaves App -
  Browser key (auto created by Firebase)"
  ([API keys](https://console.cloud.google.com/apis/credentials?project=opencaves)):
  limited to the site's addresses (`opencaves.org`, `www.opencaves.org`,
  `opencaves.web.app`, the preview channels, `opencaves.firebaseapp.com`,
  `localhost:5173`) and to the Firebase APIs it needs (Identity Toolkit,
  Secure Token, Firebase Installations, Firebase Management, App Check). It
  still allows the **Geocoding API** too, a leftover from when the app called
  Google's geocoding itself: remove it from the key's API list (the app no
  longer needs it).
- **Replace:** rarely needed. Create a new browser key with the same
  restrictions in API keys, put it in `.env`, build and deploy Hosting, then
  delete the old key.

### Mapbox: `VITE_MAPBOX_ACCESS_TOKEN`

- **For:** the map's style, tiles and fonts.
- **Used by:** the app (`src/components/Map/Map.jsx`); the map-layer scripts
  as a fallback when `MAPBOX_SCRIPTS_TOKEN` isn't set.
- **Lives in:** `.env`; the Mapbox account's
  [Access tokens](https://console.mapbox.com/account/access-tokens/).
- **Public:** yes (a `pk.` token is in every page). It is restricted to the
  site's URLs, so it can't be used from elsewhere - keep that restriction,
  with every address the app is served from (the site, the preview channels,
  `localhost` for the dev server).
- **Replace:** create a new public token with the same URL restrictions and
  scopes, put it in `.env`, build and deploy Hosting, check the map, delete
  the old token. Check usage in [Statistics](https://console.mapbox.com/account/statistics/).

### GTM container id and Google Analytics

- **For:** loading Google Tag Manager, which loads Google Analytics 4
  (`src/index.jsx`, `src/utils/analytics.js`, `src/utils/track.js`).
- **Public:** yes, an id every page shows. Nothing to rotate. Access to the
  container and the property is through your Google account
  ([Tag Manager](https://tagmanager.google.com/),
  [Analytics](https://analytics.google.com/)).

### App Check: `VITE_RECAPTCHA_SITE_KEY`

- **For:** App Check's reCAPTCHA v3 provider (`src/config/firebase.js`).
  **Not set yet**: App Check is off until it is ([App Check](app-check.md)).
- **Lives in:** the site key in `.env`; the key's **secret** in the Firebase
  console ([App Check](https://console.firebase.google.com/project/opencaves/appcheck)),
  never in a file; the key in [reCAPTCHA](https://www.google.com/recaptcha/admin).
- **Public:** the site key, yes (restricted to the site's domains); the secret
  is Firebase's alone.
- **Replace:** a new reCAPTCHA v3 key with the same domains, its secret in the
  Firebase console, its site key in `.env`, build and deploy Hosting.

## The functions' secrets

### `MAPBOX_STATIC_TOKEN`

- **For:** the share images' map cards, from Mapbox's Static Images API,
  which the app's URL-restricted token refuses outside the site
  ([Share images](maintenance.md#share-images)).
- **Used by:** `onCaveShareImage`, `onSistemaShareImage`,
  `onConnectionShareImage`, `onCaveAssetShareImage`
  (`functions/js/share/onShareImageChanges.js`); `scripts/share-images.js`
  (`MAPBOX_STATIC_TOKEN` from the environment or `.env`, else Secret Manager).
- **Lives in:** Secret Manager `MAPBOX_STATIC_TOKEN`;
  `functions/js/.secret.local` for the emulators; the Mapbox account.
- **Secret:** a public (`pk.`) token without a URL restriction (the server has
  no URL), so treat it as a secret: anyone with it can use the account's
  quota. Give it only the public scopes it needs.
- **Replace:** a new public token in Mapbox, then the steps in
  [Replacing a secret](#replacing-a-secret-in-secret-manager); redeploy
  `functions:js:onCaveShareImage,functions:js:onSistemaShareImage,functions:js:onConnectionShareImage,functions:js:onCaveAssetShareImage`;
  check with `node scripts/share-images.js -p --cave=<id> --dry-run`, then a
  record's card; delete the old token. Watch usage in
  [Statistics](https://console.mapbox.com/account/statistics/) (free tier:
  50,000 static images a month; the whole data is about 700).

### `GOOGLE_GEOCODING_API_KEY`

- **For:** a cave's address in its page and the map's pane: the
  `caveAddress` function (`/api/address/<caveId>`) asks Google's Geocoding API
  for the cave's own position.
- **Used by:** `caveAddress` (`functions/js/geocode/caveAddress.js`). The app
  only calls the function: `Address.jsx` holds no key any more (since
  2026-10-05; it used to call Google with a `VITE_` key).
- **Lives in:** Secret Manager `GOOGLE_GEOCODING_API_KEY`;
  `functions/js/.secret.local`; the Google Cloud key "OpenCaves App -
  Geocoding API" ([API keys](https://console.cloud.google.com/apis/credentials?project=opencaves)).
- **Secret:** the Geocoding API can't be restricted to the site's URLs, so the
  key stays on the server. It is restricted to the Geocoding API only.
- **Replace:** in API keys, create a key restricted to the Geocoding API, then
  the steps in [Replacing a secret](#replacing-a-secret-in-secret-manager);
  redeploy `functions:js:caveAddress`; check a cave's address (a cave not
  looked up yet: the answers are cached a month); delete the old key.
  The key in use dates from 2023, when it was built into the app: if it is
  still that one, replace it.

### `RESEND_API_KEY`

- **For:** sending email from `noreply@opencaves.org` through
  [Resend](https://resend.com) ([Emails](maintenance.md#emails)).
- **Used by:** `onFeedbackCreated`, `onFeedbackReplied`, `mapTasksSweep`,
  `setUserFrozen`, `sendWelcomeEmail` (all through
  `functions/js/email/sendEmail.js`); `scripts/send-news.js` (from the
  environment or `.env`, else Secret Manager).
- **Lives in:** Secret Manager `RESEND_API_KEY`; Resend's
  [API keys](https://resend.com/api-keys).
- **Secret, restricted:** a **send-only** key (Resend's "Sending access");
  it can also be limited to the `opencaves.org` domain.
- **Replace:** a new sending-access key in Resend, then the steps in
  [Replacing a secret](#replacing-a-secret-in-secret-manager); redeploy
  `functions:js:onFeedbackCreated,functions:js:onFeedbackReplied,functions:js:mapTasksSweep,functions:js:setUserFrozen,functions:js:sendWelcomeEmail`;
  check with `node scripts/send-news.js <news> -p --test <your email>`; delete
  the old key in Resend.

### `RESEND_INBOUND_KEY`

- **For:** reading the emails received at `*@reply.opencaves.org` (an
  author's answer to a team reply); the send-only key can't.
- **Used by:** `feedbackInbound` (`functions/js/feedback/feedbackInbound.js`).
- **Lives in:** Secret Manager `RESEND_INBOUND_KEY`; Resend's
  [API keys](https://resend.com/api-keys).
- **Secret, broad:** a **full access** key - the most powerful credential of
  the Resend account. Keep it in Secret Manager only.
- **Replace:** a new full-access key in Resend, then the steps in
  [Replacing a secret](#replacing-a-secret-in-secret-manager); redeploy
  `functions:js:feedbackInbound`; check by answering a team reply
  ([Replies by email](maintenance.md#replies-by-email)); delete the old key.

### `RESEND_WEBHOOK_SECRET`

- **For:** checking that a request to `feedbackInbound` really comes from
  Resend (its Svix signature).
- **Used by:** `feedbackInbound`.
- **Lives in:** Secret Manager `RESEND_WEBHOOK_SECRET`; Resend's
  [Webhooks](https://resend.com/webhooks) (the endpoint's signing secret).
- **Secret.** A test value may be in `functions/js/.secret.local` for the
  emulators - never production's.
- **Replace:** Resend can't roll a webhook's secret in place: add a new
  endpoint with the same URL and event (`email.received`), copy its signing
  secret, follow [Replacing a secret](#replacing-a-secret-in-secret-manager),
  redeploy `functions:js:feedbackInbound`, delete the old endpoint (until
  then, its deliveries fail the signature check and are refused). Check with a
  reply by email.

## The scripts' keys

### `BING_WEBMASTER_API_KEY`

- **For:** asking Bing to crawl pages (its URL submission API).
- **Used by:** `scripts/submit-to-search.js --bing` (from the environment or
  `.env`, else Secret Manager). No function reads it.
- **Lives in:** Secret Manager `BING_WEBMASTER_API_KEY`;
  [Bing Webmaster Tools](https://www.bing.com/webmasters/), Settings > API
  access.
- **Secret:** it acts on every site of the Bing Webmaster account.
- **Replace:** generate a new key in API access (the old one stops working),
  then step 2 of [Replacing a secret](#replacing-a-secret-in-secret-manager),
  destroy the old version; check with `node scripts/submit-to-search.js
  --bing --dry-run`.

### IndexNow key

- **For:** IndexNow (Bing, Yandex...) accepts a site's pages only from someone
  who can put the key on the site.
- **Used by:** `scripts/submit-to-search.js --indexnow` (`INDEXNOW_KEY`).
- **Lives in:** `public/<key>.txt` (deployed with Hosting) and the script.
- **Public by design:** the protocol reads it from the site. Nothing to
  protect.
- **Replace:** only if wanted: a new random key (8-128 letters, digits,
  dashes), a new `public/<key>.txt`, the same in the script, deploy Hosting,
  then remove the old file.

### `MAPBOX_SCRIPTS_TOKEN`

- **For:** the overlay and preview pages the map-layer scripts write
  (`scripts/map-layer/mapbox_token.py`): opened from a file, with no URL, so
  the app's URL-restricted token is refused there.
- **Used by:** `build_layer.py`, `overlay_scan.py`, `found_cenotes_map.py`.
- **Lives in:** `.env`; the Mapbox account (its default public token).
- **Not public:** no URL restriction, so it is kept out of the app (no `VITE_`
  prefix). The pages it writes in `_data/map-layer/` (git-ignored) contain it:
  don't share them.
- **Replace:** a new public token in Mapbox, in `.env`; rebuild the previews
  you still use.

### `GA_PROPERTY_ID`

- **For:** the GA4 property `refreshPopularity` reads page views from
  ([Popularity](maintenance.md#popularity-the-most-visited-caves-and-systems)).
- **Lives in:** `functions/js/.env` (a `defineString` param, git-ignored).
- **Not secret:** an id. What grants access is the functions' service account
  having **Viewer** on the property (Analytics, Admin > Property access
  management).

## Accounts and logins

### Service accounts (Google Cloud)

[Service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=opencaves)
and their [roles](https://console.cloud.google.com/iam-admin/iam?project=opencaves):

- **`800148490732-compute@developer.gserviceaccount.com`** (default compute):
  what the second-generation functions (`functions/js`) run as. Its roles:
  Editor (Google's default - broader than the functions need), Vertex AI User
  (Draft with AI, `draftSummary`), Eventarc Event Receiver, Cloud Run Invoker,
  and Secret Accessor on each functions secret (granted by the deploys).
  Outside IAM: **Viewer** on the GA4 property (`refreshPopularity`). No key
  file: the functions get its tokens from Google.
- **`opencaves@appspot.gserviceaccount.com`** (App Engine default): what the
  first-generation `onUserDeleted` (`functions/gen1`) runs as. Editor.
- **`firebase-adminsdk-etybp@opencaves.iam.gserviceaccount.com`**: the Admin
  SDK's account from the Firebase console. It has one user-made key (2023-04-08)
  that nothing in the project uses: the scripts sign in with your application
  default credentials. Delete that key unless you know where it is used.
- **`github-action-625268004@opencaves.iam.gserviceaccount.com`** ("GitHub
  Actions (opencaves/opencaves-app)"): made by `firebase init hosting:github`
  in 2023 for a preview-deploy workflow removed on 2023-05-31. Three user-made
  keys (2023), one of them in the GitHub repository secret
  `FIREBASE_SERVICE_ACCOUNT_OPENCAVES`; it can deploy Hosting and functions and
  manage Auth. Nothing uses it now: delete the keys (or the account) and the
  GitHub secret.

Replacing a user-made key: create a new one in the account's **Keys** tab,
put it where it's used, then delete the old one. Prefer no key at all
(application default credentials, or workload identity for GitHub).

### Google sign-in and Microsoft sign-in

The sign-in providers' OAuth clients are set in Firebase Auth's
[Sign-in method](https://console.firebase.google.com/project/opencaves/authentication/providers)
page. Google's client is Firebase's own. Microsoft's is an app registration in
[Azure](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade),
whose **client secret expires** (24 months at most): before it does, add a new
client secret in Azure (Certificates & secrets), paste it in the Microsoft
provider's settings in Firebase, check a Microsoft sign-in, then delete the old
secret in Azure. Put its expiry date in your calendar.

### Your own logins

- **`gcloud auth login`**: your Google account for `gcloud` (deploy-related
  commands, reading secrets). Needs Secret Manager access to read the secrets
  (the project's owner has it).
- **`gcloud auth application-default login`**: the credentials the scripts use
  with `-p` (Admin SDK, `applicationDefault()`), stored in your user profile
  (`%APPDATA%\gcloud\application_default_credentials.json`). Revoke with
  `gcloud auth application-default revoke`.
- **`firebase login`**: the Firebase CLI's login, for `firebase deploy`.
- **`gh auth login`**: the GitHub CLI's token (in the system keyring). Review
  it under GitHub's [Applications](https://github.com/settings/applications).
  The repository's workflow (`dependabot-auto-merge.yml`) uses only GitHub's
  automatic `GITHUB_TOKEN`.
- **Porkbun** (opencaves.org's DNS and the `feedback@` forward), **Resend**,
  **Mapbox**, **Bing Webmaster Tools**, **Google Analytics / Tag Manager**,
  **Azure**: accounts protected by their passwords and two-factor
  authentication - turn it on wherever it isn't.
