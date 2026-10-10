// <oc-relative-time datetime="2026-10-10T12:30:49Z" lang="fr">: the app's
// version of GitHub's <relative-time> element, as a Web Component. It shows
// "maintenant", "il y a 3 minutes", "hier"... (Intl.RelativeTimeFormat), and
// past DATE_AFTER the date itself (Intl.DateTimeFormat), in an open shadow
// root: a <time part="time">, styleable from outside with
// oc-relative-time::part(time). Its exact date and time is the host's title
// (set here unless the page sets one), and, for screen readers - the title
// is out of their reach, and keyboard and touch users' - visually hidden
// text after the relative one. Its light DOM - the fallback the server
// and React render, a date - shows only until the element is defined: the
// shadow root has no <slot>.
//
// Every instance keeps itself up to date from one shared ticker (below).
// Nothing here touches the DOM when the module loads: the server imports it
// too (server rendering). defineRelativeTimeElement() registers it, from the
// browser (the React wrapper's effect).

export const RELATIVE_TIME_TAG = 'oc-relative-time'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
// Past this age, the date itself instead of "n days ago" (as GitHub).
const DATE_AFTER = 30 * DAY

const STYLES = `
:host { display: inline; }
time { font: inherit; color: inherit; text-decoration: underline dotted; text-underline-offset: 3px; }
.exact { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
`

/**
 * The relative text of `date` (a Date), `now` being now, in `language`.
 *
 * @param {Date} date
 * @param {string} language
 * @param {number} [now=Date.now()]
 * @returns {string}
 */
export function formatRelativeTime(date, language, now = Date.now()) {
  const age = now - date.getTime()
  if (Math.abs(age) >= DATE_AFTER) {
    const sameYear = date.getFullYear() === new Date(now).getFullYear()
    return new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric', ...(!sameYear && { year: 'numeric' }) }).format(date)
  }
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  // Under 45 s: "now".
  if (Math.abs(age) < 45 * SECOND) return format.format(0, 'second')
  const [value, unit] = Math.abs(age) < HOUR ? [age / MINUTE, 'minute'] : Math.abs(age) < DAY ? [age / HOUR, 'hour'] : [age / DAY, 'day']
  return format.format(-Math.round(value), unit)
}

/**
 * The exact date and time, for the title.
 *
 * @param {Date} date
 * @param {string} language
 * @returns {string}
 */
export const formatExactTime = (date, language) => new Intl.DateTimeFormat(language, { dateStyle: 'full', timeStyle: 'short' }).format(date)

// --- The shared ticker -----------------------------------------------------
// One timer for every instance: every 15 s while a time shown is under a
// minute old, every minute under an hour, hourly beyond; stopped while the
// tab is hidden, and every instance redrawn when it shows again. Started by
// the first instance connected, stopped with the last.
const instances = new Set()
let timer = null

function delay() {
  const now = Date.now()
  const youngest = Math.min(...[...instances].map((element) => Math.abs(now - (element.time ?? -Infinity))))
  return youngest < MINUTE ? 15 * SECOND : youngest < HOUR ? MINUTE : HOUR
}

function schedule() {
  clearTimeout(timer)
  timer = null
  if (!instances.size || document.hidden) return
  timer = setTimeout(tick, delay())
}

function tick() {
  for (const element of instances) element.render()
  schedule()
}

function onVisibilityChange() {
  if (document.hidden) schedule()
  else tick()
}

function subscribe(element) {
  if (!instances.size) document.addEventListener('visibilitychange', onVisibilityChange)
  instances.add(element)
  schedule()
}

function unsubscribe(element) {
  instances.delete(element)
  if (instances.size) return schedule()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  clearTimeout(timer)
  timer = null
}
// ---------------------------------------------------------------------------

// Its styles, shared by every instance's shadow root (a constructed sheet
// where supported, else a <style> in each).
let sheet = null
function adoptStyles(root) {
  if ('adoptedStyleSheets' in root && typeof CSSStyleSheet === 'function') {
    try {
      if (!sheet) {
        sheet = new CSSStyleSheet()
        sheet.replaceSync(STYLES)
      }
      root.adoptedStyleSheets = [sheet]
      return
    } catch {
      // Constructed sheets unsupported: a <style> below.
    }
  }
  const style = document.createElement('style')
  style.textContent = STYLES
  root.append(style)
}

function createElementClass() {
  return class RelativeTimeElement extends HTMLElement {
    static observedAttributes = ['datetime', 'lang']

    constructor() {
      super()
      const root = this.attachShadow({ mode: 'open' })
      adoptStyles(root)
      this.timeElement = document.createElement('time')
      this.timeElement.setAttribute('part', 'time')
      this.relativeText = document.createTextNode('')
      // The exact date, read by screen readers only (.exact).
      this.exactText = document.createElement('span')
      this.exactText.className = 'exact'
      this.timeElement.append(this.relativeText, this.exactText)
      root.append(this.timeElement)
      // A title the page set itself is kept; ours follows the date.
      this.ownTitle = !this.hasAttribute('title')
    }

    // The date shown, in ms (null without a valid datetime).
    get time() {
      const time = Date.parse(this.getAttribute('datetime') || '')
      return Number.isNaN(time) ? null : time
    }

    // Its language: its lang attribute, else the closest ancestor's.
    get language() {
      return this.closest('[lang]')?.getAttribute('lang') || navigator.language || 'en'
    }

    connectedCallback() {
      this.render()
      subscribe(this)
    }

    disconnectedCallback() {
      unsubscribe(this)
    }

    attributeChangedCallback() {
      if (!this.isConnected) return
      this.render()
      // A new date may need a faster (or slower) tick.
      schedule()
    }

    render() {
      const time = this.time
      if (time == null) {
        this.timeElement.removeAttribute('datetime')
        this.relativeText.data = ''
        this.exactText.textContent = ''
        return
      }
      const date = new Date(time)
      const language = this.language
      this.timeElement.setAttribute('datetime', date.toISOString())
      const exact = formatExactTime(date, language)
      this.relativeText.data = formatRelativeTime(date, language)
      this.exactText.textContent = ` (${exact})`
      if (this.ownTitle) this.setAttribute('title', exact)
    }
  }
}

/**
 * Registers <oc-relative-time>, once; only in a browser.
 */
export function defineRelativeTimeElement() {
  if (typeof customElements === 'undefined' || customElements.get(RELATIVE_TIME_TAG)) return
  customElements.define(RELATIVE_TIME_TAG, createElementClass())
}
