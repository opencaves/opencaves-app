// <oc-relative-time datetime="2026-10-10T12:30:49Z" lang="fr" focusable>:
// the app's version of GitHub's <relative-time> element, as a Web Component.
// It shows "maintenant", "il y a 3 minutes", "hier"...
// (Intl.RelativeTimeFormat), and past DATE_AFTER the date itself
// (Intl.DateTimeFormat), in an open shadow root: a <time part="time">,
// styleable from outside with oc-relative-time::part(time), tagged with the
// language Intl actually used (Firefox doesn't carry :lang into shadow
// roots, and Intl falls back for a language it lacks).
//
// Its exact date and time:
// - for screen readers, visually hidden text after the relative one,
//   shorter (no weekday), and none once the date itself is shown;
// - for everyone else, a tooltip (part="tooltip", aria-hidden: screen
//   readers have the text above) on mouse hover and on keyboard focus, in
//   the top layer (Popover API, else position: fixed). It stays while the
//   pointer is over it and until hover and focus leave, and Escape hides it
//   without moving focus (WCAG 1.4.13). The host has no title: a native one
//   would be mouse-only and become the host's accessible name.
// With the focusable attribute the host is a Tab stop (tabindex="0", unless
// the page set one) with a focus ring, and a tap focuses it, showing the
// tooltip; without it - the default, e.g. inside a link - it isn't.
// Its light DOM - the fallback the server and React render, a date - shows
// only until the element is defined: the shadow root has no <slot>.
//
// Every instance keeps itself up to date from one shared ticker (below),
// writing to the DOM only what changed (no accessibility events on an
// unchanged tick); never live-announced. Nothing here touches the DOM when
// the module loads: the server imports it too (server rendering).
// defineRelativeTimeElement() registers it, from the browser (the React
// wrapper's effect).

export const RELATIVE_TIME_TAG = 'oc-relative-time'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
// Past this age, the date itself instead of "n days ago" (as GitHub).
const DATE_AFTER = 30 * DAY

// The tooltip's colours: M3's plain tooltip, the inverse surface and its
// text (the app's theme variables, so they follow dark mode), overridable
// with --oc-relative-time-tooltip-background and -color, or ::part(tooltip).
const STYLES = `
:host { display: inline; }
:host(:focus-visible) { outline: 2px solid currentColor; outline-offset: 2px; border-radius: 2px; }
time { font: inherit; color: inherit; text-decoration: underline dotted; text-underline-offset: 3px; }
.exact { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.tooltip {
  position: fixed; inset: auto; z-index: 2147483647; box-sizing: border-box; width: max-content; max-width: min(20rem, calc(100vw - 16px)); height: auto;
  margin: 0; padding: 4px 8px; border: 0; border-radius: 4px; overflow: visible;
  background: var(--oc-relative-time-tooltip-background, var(--mui-sys-color-inverseSurface, #313033));
  color: var(--oc-relative-time-tooltip-color, var(--mui-sys-color-inverseOnSurface, #f4eff4));
  box-shadow: 0 1px 2px rgb(0 0 0 / 30%), 0 2px 6px 2px rgb(0 0 0 / 15%);
  font-family: inherit; font-size: 0.75rem; font-style: normal; font-weight: 400; line-height: 1rem; letter-spacing: 0.025em;
  text-align: start; text-decoration: none; text-transform: none; white-space: normal; overflow-wrap: anywhere;
}
.tooltip:not(.open) { display: none; }
`

// The gap between the text and its tooltip, and the tooltip's least
// distance from the viewport's edges, in px.
const TOOLTIP_GAP = 4
const TOOLTIP_MARGIN = 8
// How long the tooltip waits before hiding once the pointer leaves, so it
// can cross the gap onto the tooltip (hoverable), in ms.
const TOOLTIP_HIDE_DELAY = 150

/**
 * The locale Intl actually uses for `language` (its own fallback when it
 * lacks that language, e.g. "yua"), undefined for an invalid tag.
 *
 * @param {string} language
 * @returns {string|undefined}
 */
export function resolveLanguage(language) {
  try {
    return new Intl.RelativeTimeFormat(language).resolvedOptions().locale
  } catch {
    return undefined
  }
}

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
 * The exact date and time: in full for the tooltip ("Saturday, October 10,
 * 2026 at 12:49 PM"), long for screen readers ("October 10, 2026 at
 * 12:49 PM", no weekday: shorter to listen to).
 *
 * @param {Date} date
 * @param {string} language
 * @param {'full'|'long'} [dateStyle='full']
 * @returns {string}
 */
export const formatExactTime = (date, language, dateStyle = 'full') => new Intl.DateTimeFormat(language, { dateStyle, timeStyle: 'short' }).format(date)

// Sets `element`'s `name` attribute to `value` (removes it for null), only
// when it changes: an unchanged write would still fire mutation and
// accessibility events.
function setAttribute(element, name, value) {
  if (value == null) {
    if (element.hasAttribute(name)) element.removeAttribute(name)
  } else if (element.getAttribute(name) !== value) element.setAttribute(name, value)
}

// Sets a text node's or element's text, only when it changes.
function setText(node, text) {
  if (node.textContent !== text) node.textContent = text
}

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
  // The tooltip in the top layer where the Popover API is (no clipping by an
  // ancestor's overflow, above everything), else position: fixed.
  const popover = typeof HTMLElement.prototype.showPopover === 'function'

  return class RelativeTimeElement extends HTMLElement {
    static observedAttributes = ['datetime', 'lang', 'focusable']

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
      // The exact date for sighted users; hidden from screen readers, which
      // read the text above.
      this.tooltip = document.createElement('span')
      this.tooltip.className = 'tooltip'
      this.tooltip.setAttribute('part', 'tooltip')
      this.tooltip.setAttribute('aria-hidden', 'true')
      if (popover) this.tooltip.setAttribute('popover', 'manual')
      root.append(this.timeElement, this.tooltip)

      // The tooltip shows while hovered (mouse or pen: a touch's emulated
      // hover is ignored, a tap focuses instead) or focused, unless Escape
      // dismissed it - until the next hover or focus.
      this.hovered = false
      this.focused = false
      this.dismissed = false
      this.tooltipOpen = false
      this.hideTimer = null
      // Whether the tabindex is ours (focusable), not the page's.
      this.ownTabindex = false
      this.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'touch') return
        clearTimeout(this.hideTimer)
        if (!this.hovered) this.dismissed = false
        this.hovered = true
        this.updateTooltip()
      })
      // The pointer crossing the gap onto the tooltip - a shadow descendant,
      // so entering it re-enters the host - keeps it (hoverable).
      this.addEventListener('pointerleave', (event) => {
        if (event.pointerType === 'touch') return
        clearTimeout(this.hideTimer)
        this.hideTimer = setTimeout(() => {
          this.hovered = false
          this.updateTooltip()
        }, TOOLTIP_HIDE_DELAY)
      })
      this.addEventListener('focus', () => {
        this.focused = true
        this.dismissed = false
        this.updateTooltip()
      })
      this.addEventListener('blur', () => {
        this.focused = false
        this.updateTooltip()
      })
      // Escape hides an open tooltip, focus staying put; caught first
      // (capture) and kept from the page, which would otherwise also close
      // the dialog or pane around it.
      this.onKeyDown = (event) => {
        if (event.key !== 'Escape' || !this.tooltipOpen) return
        this.dismissed = true
        this.updateTooltip()
        event.stopPropagation()
      }
      this.onViewportChange = () => this.positionTooltip()
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
      this.updateFocusable()
      this.render()
      subscribe(this)
    }

    disconnectedCallback() {
      unsubscribe(this)
      clearTimeout(this.hideTimer)
      this.hovered = false
      this.focused = false
      this.updateTooltip()
    }

    attributeChangedCallback(name) {
      if (!this.isConnected) return
      if (name === 'focusable') return this.updateFocusable()
      this.render()
      // A new date may need a faster (or slower) tick.
      schedule()
    }

    // focusable: a Tab stop, unless the page set its own tabindex.
    updateFocusable() {
      if (this.hasAttribute('focusable')) {
        if (this.hasAttribute('tabindex')) return
        this.setAttribute('tabindex', '0')
        this.ownTabindex = true
      } else if (this.ownTabindex) {
        this.removeAttribute('tabindex')
        this.ownTabindex = false
      }
    }

    // Shows or hides the tooltip as hover, focus and Escape say.
    updateTooltip() {
      const open = (this.hovered || this.focused) && !this.dismissed && this.isConnected && Boolean(this.tooltip.textContent)
      if (open === this.tooltipOpen) return
      this.tooltipOpen = open
      this.tooltip.classList.toggle('open', open)
      if (popover) {
        try {
          if (open) this.tooltip.showPopover()
          else this.tooltip.hidePopover()
        } catch {
          // Already in that state, or disconnected.
        }
      }
      const method = open ? 'addEventListener' : 'removeEventListener'
      document[method]('keydown', this.onKeyDown, true)
      window[method]('scroll', this.onViewportChange, true)
      window[method]('resize', this.onViewportChange)
      this.positionTooltip()
    }

    // Below the text (its last line), else above it (its first line) when
    // there is no room below; centred on it, kept inside the viewport.
    positionTooltip() {
      if (!this.tooltipOpen) return
      const lines = this.timeElement.getClientRects()
      if (!lines.length) return
      const first = lines[0]
      const last = lines[lines.length - 1]
      const { clientWidth, clientHeight } = document.documentElement
      const { width, height } = this.tooltip.getBoundingClientRect()
      let top = last.bottom + TOOLTIP_GAP
      let anchor = last
      if (top + height > clientHeight - TOOLTIP_MARGIN && first.top - TOOLTIP_GAP - height >= TOOLTIP_MARGIN) {
        top = first.top - TOOLTIP_GAP - height
        anchor = first
      }
      const left = Math.max(TOOLTIP_MARGIN, Math.min(anchor.left + anchor.width / 2 - width / 2, clientWidth - TOOLTIP_MARGIN - width))
      this.tooltip.style.left = `${Math.round(left)}px`
      this.tooltip.style.top = `${Math.round(top)}px`
    }

    // Writes only what changed: a tick that leaves the text as it was
    // changes nothing in the DOM, so nothing in the accessibility tree.
    render() {
      const time = this.time
      if (time == null) {
        setAttribute(this.timeElement, 'datetime', null)
        setAttribute(this.timeElement, 'lang', null)
        setText(this.relativeText, '')
        setText(this.exactText, '')
        setText(this.tooltip, '')
        this.updateTooltip()
        return
      }
      const date = new Date(time)
      const now = Date.now()
      // The language Intl formats in, which the text is tagged with.
      const language = resolveLanguage(this.language)
      setAttribute(this.timeElement, 'datetime', date.toISOString())
      setAttribute(this.timeElement, 'lang', language ?? null)
      setAttribute(this.tooltip, 'lang', language ?? null)
      setText(this.relativeText, formatRelativeTime(date, language, now))
      // No exact text once the date itself is shown.
      setText(this.exactText, Math.abs(now - time) >= DATE_AFTER ? '' : ` (${formatExactTime(date, language, 'long')})`)
      setText(this.tooltip, formatExactTime(date, language))
      this.positionTooltip()
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
