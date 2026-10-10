import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { REGION, SITE_URL } from '../constants.js'
import { accountOfUnsubscribeToken } from '../email/unsubscribe.js'
import { UNSUBSCRIBE_PAGE_CONTENT } from './unsubscribeContent.js'

const LANGUAGES = Object.keys(UNSUBSCRIBE_PAGE_CONTENT)
const SETTINGS_URL = `${SITE_URL}/account`

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// A small page of its own (no app bundle): the OpenCaves name, a heading, a
// text and a link to the settings, light or dark like the device. Colours:
// the app theme's (src/theme/Theme.jsx).
// action: the form's address and button label ({ url, label }), for the
// confirmation; the settings button then becomes a plain link under it.
function page({ language, title, heading, paragraphs, button, action = null }) {
  return `<!doctype html>
<html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="color-scheme" content="light dark">
<title>${escape(title)} · OpenCaves</title>
<style>
:root{--oc-bg:#eceae8;--oc-card:#fff;--oc-text:#1c1b1f;--oc-muted:#5b5960;--oc-primary:#145e79;--oc-on-primary:#fff}
@media (prefers-color-scheme:dark){:root{--oc-bg:#141218;--oc-card:#211f26;--oc-text:#e6e1e5;--oc-muted:#cac4d0;--oc-primary:#8bcfe8;--oc-on-primary:#00344a}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:var(--oc-bg);color:var(--oc-text);font:16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
main{width:100%;max-width:480px;background:var(--oc-card);border-radius:20px;padding:32px 28px}
.oc-unsubscribe--brand{display:inline-block;margin:0 0 20px;font-size:20px;font-weight:600;color:var(--oc-primary);text-decoration:none}
h1{margin:0 0 12px;font-size:24px;line-height:32px;font-weight:600}
p{margin:0 0 14px;color:var(--oc-muted)}
.oc-unsubscribe--button{display:inline-block;margin-top:8px;padding:10px 24px;border:0;border-radius:20px;background:var(--oc-primary);color:var(--oc-on-primary);font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
.oc-unsubscribe--form{margin:0}
.oc-unsubscribe--link{display:inline-block;margin-top:16px;color:var(--oc-primary)}
</style></head>
<body><main class="oc-unsubscribe">
<a class="oc-unsubscribe--brand" href="${SITE_URL}">OpenCaves</a>
<h1>${escape(heading)}</h1>
${paragraphs.map((text) => `<p>${escape(text)}</p>`).join('\n')}
${action
    ? `<form class="oc-unsubscribe--form" method="post" action="${escape(action.url)}"><input type="hidden" name="confirm" value="1"><button class="oc-unsubscribe--button" type="submit">${escape(action.label)}</button></form>
<a class="oc-unsubscribe--link" href="${SETTINGS_URL}">${escape(button)}</a>`
    : `<a class="oc-unsubscribe--button" href="${SETTINGS_URL}">${escape(button)}</a>`}
</main></body></html>`
}

// The language of the page: the account's (its settings), else the browser's
// among the app's, else English.
function languageOf(req, account) {
  const own = account?.get('language')
  if (LANGUAGES.includes(own)) return own
  return req.acceptsLanguages(...LANGUAGES) || 'en'
}

/**
 * The feedback emails' unsubscribe link (/email/unsubscribe?t=<token>, a
 * Hosting rewrite; the token: email/unsubscribe.js), without signing in.
 * Opening it (GET) changes nothing - mail scanners open every link of an
 * email: a page asks to confirm, its button posting back (confirm=1); then
 * the account's feedbackEmails is turned off and a page says so, with a link
 * to the settings to turn them back on (already off: that page at once). A
 * POST without confirm is RFC 8058's one-click (the mail app's own
 * Unsubscribe button, List-Unsubscribe-Post): turned off, a short answer.
 * Idempotent. An unknown or malformed token: 400, with no detail. Never
 * cached; the token is never logged.
 */
export const feedbackUnsubscribe = onRequest({ region: REGION, maxInstances: 5 }, async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.set('X-Robots-Tag', 'noindex')
  res.set('Referrer-Policy', 'no-referrer')
  const post = req.method === 'POST'
  if (!post && req.method !== 'GET' && req.method !== 'HEAD') {
    res.set('Allow', 'GET, POST').status(405).end()
    return
  }
  // The confirmation page's own button, as opposed to a mail app's one-click.
  const confirmed = post && String(req.body?.confirm || '') === '1'
  const token = String(req.query.t || '')
  let account = null
  let failed = false
  let off = false
  try {
    account = await accountOfUnsubscribeToken(token)
    off = account?.get('feedbackEmails') === false
    if (account && post && !off) {
      await account.ref.update({ feedbackEmails: false })
      off = true
      logger.info('[feedback] an author unsubscribed from the feedback emails', { uid: account.id, via: confirmed ? 'page' : 'one-click' })
    }
  } catch (error) {
    failed = true
    logger.error('[feedback] the unsubscribe failed', { error: error.message })
  }

  if (post && !confirmed) {
    res.status(failed ? 500 : account ? 200 : 400).type('text/plain').send(failed ? 'Error' : account ? 'Unsubscribed' : 'Invalid link')
    return
  }
  const language = languageOf(req, account)
  const c = UNSUBSCRIBE_PAGE_CONTENT[language]
  res.set('Content-Language', language)
  if (failed) {
    res.status(500).type('html').send(page({ language, title: c.errorTitle, heading: c.errorTitle, paragraphs: [c.errorText], button: c.button }))
  } else if (!account) {
    res.status(400).type('html').send(page({ language, title: c.invalidTitle, heading: c.invalidHeading, paragraphs: [c.invalidText], button: c.button }))
  } else if (!off) {
    // The address the page was opened at, for its form (relative: Hosting's).
    const url = `/email/unsubscribe?t=${encodeURIComponent(token)}`
    res.status(200).type('html').send(page({ language, title: c.confirmTitle, heading: c.confirmHeading, paragraphs: [c.confirmText], button: c.settingsLink, action: { url, label: c.confirmButton } }))
  } else {
    res.status(200).type('html').send(page({ language, title: c.title, heading: c.heading, paragraphs: [c.text, c.settings], button: c.button }))
  }
})
