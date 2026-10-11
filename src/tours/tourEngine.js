// The guided tours' engine: driver.js (MIT) draws the scrim, the
// highlighted element and the popover; this module walks a tour's steps
// (tourSteps.js) - going to the page a step needs, opening the menu it's
// in, waiting for its element - and skips a step whose element doesn't show
// (a control the visitor doesn't have, a feature the browser lacks). Loaded
// only when a tour starts (tourList.js' startTour), with driver.js.
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import './tours.scss'
import { setCaveLayerVisible } from '@/redux/slices/caveLayerSlice.jsx'

// How long a step waits for its element by default, in ms.
const DEFAULT_TIMEOUT = 4000
// How long a menu takes to close (its transition), at most.
const CLOSE_TIMEOUT = 1000
// The close button's icon: Material Symbols' close, rounded.
const CLOSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59 7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12 5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z"/></svg>'

// The tour running, stopped when another starts.
let current = null

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

/**
 * Whether an element is shown: in the page, with a size, not hidden nor
 * faded out (itself or an ancestor).
 *
 * @param {Element|null} element
 * @returns {boolean}
 */
function displayed(element) {
  if (!element?.isConnected) return false
  const { width, height } = element.getBoundingClientRect()
  if (!width || !height) return false
  if (typeof element.checkVisibility === 'function') return element.checkVisibility({ opacityProperty: true, visibilityProperty: true })
  const style = getComputedStyle(element)
  return style.visibility !== 'hidden' && style.opacity !== '0'
}

/**
 * Whether part of an element is on the screen.
 *
 * @param {Element} element
 * @returns {boolean}
 */
function onScreen(element) {
  const { top, left, bottom, right } = element.getBoundingClientRect()
  return bottom > 0 && right > 0 && top < window.innerHeight && left < window.innerWidth
}

/**
 * The first element shown that a target names.
 *
 * @param {import('./tourSteps.js').TourStep['target']} target
 * @returns {Element|null}
 */
function findShown(target) {
  if (typeof target === 'function') {
    const element = target()
    return displayed(element) ? element : null
  }
  for (const selector of Array.isArray(target) ? target : [target]) {
    const element = [...document.querySelectorAll(selector)].find(displayed)
    if (element) return element
  }
  return null
}

/**
 * Waits for a target's element to show, scrolled onto the screen and
 * settled where it is (a menu's or a pane's opening transition over).
 *
 * @param {import('./tourSteps.js').TourStep['target']} target
 * @param {number} timeout - In ms.
 * @param {() => boolean} cancelled
 * @returns {Promise<Element|null>} Null once the time is up.
 */
async function waitForTarget(target, timeout, cancelled) {
  const until = Date.now() + timeout
  while (Date.now() < until && !cancelled()) {
    const element = findShown(target)
    if (element) {
      if (!onScreen(element)) element.scrollIntoView({ block: 'center', inline: 'nearest' })
      // Settled: the same place two frames in a row.
      let before = element.getBoundingClientRect()
      for (let frame = 0; frame < 30; frame++) {
        await nextFrame()
        const after = element.getBoundingClientRect()
        if (Math.abs(after.top - before.top) < 0.5 && Math.abs(after.left - before.left) < 0.5 && Math.abs(after.height - before.height) < 0.5) break
        before = after
      }
      if (displayed(element) && onScreen(element)) return element
    }
    await sleep(100)
  }
  return null
}

/**
 * Waits (up to a time) until a condition holds.
 *
 * @param {() => boolean} condition
 * @param {number} timeout - In ms.
 * @returns {Promise<void>}
 */
async function waitUntil(condition, timeout) {
  const until = Date.now() + timeout
  while (!condition() && Date.now() < until) await sleep(50)
}

// The attributes driver.js sets on the element it points at, put back by
// itself only while that element keeps its class (a re-render resets it).
const POINTED_ATTRIBUTES = ['aria-haspopup', 'aria-expanded', 'aria-controls']

/**
 * Notes an element's attributes driver.js will change, to put them back.
 *
 * @param {Element|null} element
 * @returns {() => void} Puts them back.
 */
function keepAttributes(element) {
  if (!element) return () => {}
  const kept = POINTED_ATTRIBUTES.map((name) => [name, element.getAttribute(name)])
  return () => kept.forEach(([name, value]) => (value === null ? element.removeAttribute(name) : element.setAttribute(name, value)))
}

const clickFirst = (target) => /** @type {HTMLElement|null} */ (findShown(target))?.click()

// The menus a step can be in: how to tell they're open, open them, close them.
const MENUS = {
  appMenu: {
    isOpen: () => Boolean(findShown('.oc-app-menu-panel')),
    open: () => clickFirst('.oc-app-menu'),
    close: () => clickFirst('.oc-app-menu-panel--close'),
  },
  navDrawer: {
    isOpen: () => Boolean(findShown('.oc-nav-drawer--list')),
    open: () => clickFirst(['.oc-search-bar--menu', '.oc-app-bar--menu']),
    close: () => clickFirst('.oc-nav-drawer--close'),
  },
}

/**
 * How this browser installs a web app (the install tour's instructions).
 *
 * @returns {import('./tourSteps.js').TourContext['platform']}
 */
function installPlatform() {
  const agent = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(agent)) return 'android'
  if (/Edg\/|Chrome\/|Chromium\//.test(agent) && !/Firefox\//.test(agent)) return 'chromium'
  if (/Safari\//.test(agent) && /Macintosh/.test(agent)) return 'safari'
  return 'other'
}

/**
 * What the steps can know of the app and the device, as the tour starts.
 *
 * @param {import('@reduxjs/toolkit').EnhancedStore} store
 * @returns {import('./tourSteps.js').TourContext}
 */
function tourContext(store) {
  const media = (query) => window.matchMedia(query).matches
  return {
    // The theme's breakpoints: under sm (600px), under md (900px).
    phone: media('(max-width: 599.95px)'),
    compact: media('(max-width: 899.95px)'),
    loggedIn: Boolean(store.getState().session.isLoggedIn),
    installed: media('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui), (display-mode: window-controls-overlay)') || /** @type {any} */ (navigator).standalone === true,
    platform: installPlatform(),
  }
}

/**
 * Runs a tour from its first step: the page each step needs, its menu, its
 * element - or the step skipped when that element doesn't show. Back, Next
 * and Done, the arrow keys and Escape (driver.js); closing it leaves the
 * page where the tour was, its menus closed and the cave layer as it was.
 *
 * @param {import('./tourSteps.js').Tour} tour
 * @param {object} options
 * @param {(to: string) => Promise<void> | void} options.navigate - The app router's navigate.
 * @param {(key: string, options?: object) => string} options.t - The `tours` namespace's translations.
 * @param {import('@reduxjs/toolkit').EnhancedStore} options.store - The app's Redux store.
 */
export function runTour(tour, { navigate, t, store }) {
  current?.stop()

  const context = tourContext(store)
  const steps = tour.steps.filter((step) => !step.when || step.when(context))
  if (!steps.length) return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Each step's element, once found.
  const elements = []
  let active = -1
  let busy = false
  let stopped = false
  // The menu the tour opened, and the cave layer's visibility before it.
  let openMenu = null
  let caveLayerBefore = null
  // The element pointed at last, and how to put its attributes back.
  let pointed = null
  let restorePointed = () => {}

  const textKey = (step, part) => {
    const variant = step.variant?.(context)
    return `steps.${tour.id}.${step.id}.${variant ? `${variant}.` : ''}${part}`
  }

  const tourDriver = driver({
    steps: steps.map((step, index) => ({
      element: () => elements[index] || undefined,
      popover: {
        title: escapeHtml(t(textKey(step, 'title'))),
        description: escapeHtml(t(textKey(step, 'text'))),
        side: step.side,
        align: step.align || (step.target ? 'start' : 'center'),
      },
    })),
    animate: !reducedMotion,
    smoothScroll: !reducedMotion,
    overlayColor: 'var(--oc-tour-scrim)',
    overlayOpacity: 1,
    // A tap beside the popover doesn't end the tour by accident: its close
    // button and Escape do.
    overlayClickBehavior: () => {},
    stagePadding: 6,
    stageRadius: 12,
    popoverOffset: 8,
    // What's pointed at is shown, not used, while the tour runs.
    disableActiveInteraction: true,
    showProgress: true,
    popoverClass: 'oc-tour-popover',
    nextBtnText: escapeHtml(t('buttons.next')),
    prevBtnText: escapeHtml(t('buttons.back')),
    doneBtnText: escapeHtml(t('buttons.done')),
    closeBtnLabel: t('buttons.close'),
    onNextClick: () => go(active + 1, 1),
    onPrevClick: () => go(active - 1, -1),
    onPopoverRender: (popover) => {
      popover.progress.textContent = t('progress', { current: active + 1, total: steps.length })
      popover.closeButton.innerHTML = CLOSE_ICON
      popover.closeButton.title = t('buttons.close')
      // The focus on Next (Done), the step's main action - driver.js puts it
      // on the first button, the close one.
      queueMicrotask(() => popover.nextButton.focus())
    },
    onDestroyed: () => stop(),
  })

  async function closeMenu() {
    if (!openMenu) return
    const menu = MENUS[openMenu]
    openMenu = null
    if (menu.isOpen()) {
      menu.close()
      await waitUntil(() => !menu.isOpen(), CLOSE_TIMEOUT)
    }
  }

  // The page, menu and layer a step needs.
  async function prepare(step) {
    if (step.open !== openMenu) await closeMenu()
    if (step.route && window.location.pathname !== step.route) await navigate(step.route)
    if (step.caveLayer && !store.getState().caveLayer.visible) {
      caveLayerBefore ??= false
      store.dispatch(setCaveLayerVisible(true))
    }
    if (step.open && !MENUS[step.open].isOpen()) {
      // The button opening it may still be on its way (a page just shown).
      await waitForTarget(step.open === 'appMenu' ? '.oc-app-menu' : ['.oc-search-bar--menu', '.oc-app-bar--menu'], DEFAULT_TIMEOUT, () => stopped)
      MENUS[step.open].open()
      openMenu = step.open
    }
  }

  // To a step, the next one shown in that direction: the first step's
  // Back does nothing; past the last step, the tour ends.
  async function go(index, direction) {
    if (busy || stopped) return
    busy = true
    try {
      for (let i = index; i >= 0 && i < steps.length; i += direction) {
        const step = steps[i]
        await prepare(step)
        if (stopped) return
        const element = step.target ? await waitForTarget(step.target, step.timeout ?? DEFAULT_TIMEOUT, () => stopped) : null
        if (stopped) return
        if (step.target && !element) continue
        elements[i] = element
        active = i
        // The same element again: its attributes are already noted.
        const restorePrevious = element === pointed ? () => {} : restorePointed
        if (element !== pointed) restorePointed = keepAttributes(element)
        pointed = element
        if (tourDriver.isActive()) tourDriver.moveTo(i)
        else tourDriver.drive(i)
        restorePrevious()
        return
      }
      if (direction > 0) tourDriver.destroy()
    } catch (error) {
      console.error(error)
      tourDriver.destroy()
    } finally {
      busy = false
    }
  }

  function stop() {
    if (stopped) return
    stopped = true
    if (current === controller) current = null
    if (tourDriver.isActive()) tourDriver.destroy()
    restorePointed()
    closeMenu()
    if (caveLayerBefore === false) store.dispatch(setCaveLayerVisible(false))
  }

  const controller = { stop }
  current = controller
  go(0, 1)
}
