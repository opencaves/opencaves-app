# App Check

App Check lets Firestore, Storage and the Cloud Functions refuse requests
that don't come from the OpenCaves app itself - scripts calling the Firebase
APIs directly with the app's public keys. The app proves itself with
reCAPTCHA v3, which is free and invisible to visitors.

It is wired in the code but **off** until a site key is set, and nothing is
**enforced** until you turn enforcement on, one service at a time. Turning
enforcement on too early locks out every visitor whose app doesn't send a
token yet, so follow the steps in order.

## 1. Register the app

1. Firebase console > **App Check** > **Apps** > the web app > **reCAPTCHA**.
   Follow the link to create a reCAPTCHA v3 key, with the domains
   `opencaves.org`, `www.opencaves.org`, `opencaves.web.app` and
   `opencaves.firebaseapp.com`.
2. Paste the key's **secret** in the Firebase console, and its **site key** in
   `.env` as `VITE_RECAPTCHA_SITE_KEY`.
3. Build and deploy the hosting (`npm run build`, then
   `firebase deploy --only hosting`).

The app now sends App Check tokens. It doesn't on `localhost`: the emulators
don't check them.

## 2. Watch the metrics

Firebase console > **App Check** > **APIs**: each service (Cloud Firestore,
Cloud Storage, Cloud Functions) shows how many requests came with a valid
token. Wait until nearly all of them do - a few days, so that visitors'
installed copies of the app (the service worker) have updated.

The rest are old copies of the app, or scripts. Enforcing refuses both.

## 3. Enforce

- **Firestore and Storage:** Firebase console > **App Check** > **APIs** >
  the service > **Enforce**. Takes effect within minutes; **Unenforce** undoes
  it.
- **Callable functions** (`ensureEditorRole` and the admin's user
  management): set `ENFORCE_APP_CHECK` to `true` in
  `functions/js/constants.js`, then `firebase deploy --only functions`.

The public pages (`/map/:caveId`, `/caves`, `/sistemas`, `/areas/...`,
`/sistemas/...`, `/sitemap.xml`) don't use App Check: search
engines must be able to read them.

## Also against abuse

- **Budget alerts:** Google Cloud console > **Billing** > **Budgets &
  alerts**, so a surge of use is noticed.
- **Email enumeration protection:** Firebase console > **Authentication** >
  **Settings** > **User actions**.
