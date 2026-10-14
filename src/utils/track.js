import { analyticsAllowed } from './analytics.js'

// What an event's parameters may hold: short values only (GA4 cuts a
// parameter's value at 100 characters), never personal data - no account id,
// email or free text but a search's words.
const MAX_VALUE_LENGTH = 100

/**
 * Sends an analytics event (Google Analytics, through Tag Manager) - when
 * analytics is allowed on this visit ({@link analyticsAllowed}: the real site,
 * no automation, no opt-out); nothing otherwise, nor on the server. Written in
 * gtag's own form in Tag Manager's queue (`window.dataLayer`), which the
 * Google Analytics tag Tag Manager loads reads (queued until it has loaded).
 * GA4's recommended names where one fits (tutorial_begin, share, search,
 * select_content, login, sign_up...).
 *
 * @param {string} name - The event's name (snake_case, 40 characters at most).
 * @param {Record<string, string|number|boolean|null|undefined>} [params] - Its parameters; empty ones are left out.
 */
export function track(name, params = {}) {
  if (typeof window === 'undefined') return
  try {
    if (!analyticsAllowed()) return
  } catch {
    return
  }
  const clean = {}
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue
    clean[key] = typeof value === 'string' ? value.slice(0, MAX_VALUE_LENGTH) : value
  }
  window.dataLayer = window.dataLayer || []
  // gtag()'s own call: an arguments object, not an array (the tag ignores arrays).
  ;(function gtag() {
    window.dataLayer.push(arguments) // eslint-disable-line prefer-rest-params
  })('event', name, clean)
}
