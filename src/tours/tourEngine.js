// The guided tours' engine: driver.js (MIT) draws the scrim, the
// highlighted element and the popover; this module walks a tour's steps
// (tourSteps.js) - going to the page a step needs, opening the menu it's
// in, waiting for its element - and skips a step whose element doesn't show
// (a control the visitor doesn't have, a feature the browser lacks). Loaded
// only when a tour starts (tourList.js' startTour), with driver.js.
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import './tours.scss'
import { installPlatform } from './tourSteps.js'
import { setCaveLayerVisible } from '@/redux/slices/caveLayerSlice.jsx'
import { requestFlyToCoordinate } from '@/redux/slices/mapSlice.jsx'
import i18n from '@/i18n.js'
import { toServiceLanguage } from '@/utils/lang.js'

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

// The lit area around a step's element: its room around it, its corners.
const STAGE_PADDING = 6
const STAGE_RADIUS = 12

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

// A step's pointer: a hand, its index finger raised (PanToolAltRounded) -
// "look here", not an arrow, which reads as navigation. Pointing up as drawn,
// turned over to point down (tours.scss).
const POINTER_HAND = 'M5.2 15.43c0-.65.6-1.13 1.24-.99l3.56.8V4.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v6h.91c.31 0 .62.07.89.21l4.09 2.04c.77.38 1.21 1.22 1.09 2.07l-.63 4.46c-.14.99-.99 1.72-1.98 1.72h-6.16c-.53 0-1.29-.21-1.66-.59l-4.07-4.29c-.18-.18-.28-.43-.28-.69'

// A large pointer outside a step's popover, at what's out of the page (the
// browser's own controls): up or down (the hand turned over by its class).
const pointerSvg = () => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${POINTER_HAND}"/></svg>`

// Icons a step's text can show inline, by a [[name]] marker in its string
// (after "the three dots", "the menu": the browser's menu button as it
// looks - Chrome's and Firefox's three dots, Safari's on an iPhone lying).
const INLINE_ICONS = {
  safariMenu: '<svg class="oc-tour-inline-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2"/></svg>',
  dots: '<svg class="oc-tour-inline-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2m0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2"/></svg>',
}
// Escaped text with its [[name]] markers drawn as their icons, each kept on
// one line with the word before it and the punctuation after it.
const richText = (text) =>
  escapeHtml(text).replace(/(\S+) \[\[(\w+)\]\](\S*)/g, (marker, before, name, after) => `<span class="oc-tour-nowrap">${before} ${INLINE_ICONS[name] ?? ''}${after}</span>`)

// The line arrow before each step's title (the app's LineArrow, icons.jsx:
// a diver's Dorff arrow - its slots and holes cut out through a mask; one
// popover at a time, so one id).
const LINE_ARROW = '<svg class="oc-tour-title-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><defs><mask id="oc-tour-line-arrow"><path d="M3.5 5.5 L21.5 12 L3.5 18.5 Z" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M10.6 4.8 L8.6 12 M12.4 19.2 L14.4 12" stroke="#000" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.6" cy="12" r="1.1" fill="#000"/><circle cx="14.4" cy="12" r="1.1" fill="#000"/></mask></defs><rect width="24" height="24" fill="currentColor" mask="url(#oc-tour-line-arrow)"/></svg>'


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
 * @param {ScrollLogicalPosition} [scroll] - Where to scroll it on the screen, even when it's
 *   already on it; without, only when it isn't, to the centre.
 * @returns {Promise<Element|null>} Null once the time is up.
 */
async function waitForTarget(target, timeout, cancelled, scroll) {
  const until = Date.now() + timeout
  while (Date.now() < until && !cancelled()) {
    const element = findShown(target)
    if (element) {
      if (scroll) element.scrollIntoView({ block: scroll, inline: 'nearest' })
      else if (!onScreen(element)) element.scrollIntoView({ block: 'center', inline: 'nearest' })
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

// Whether a drawer that stays in the page when closed (the filter menu) is
// open: shown, and on the screen (closed, it's slid off it).
const drawerOpen = (selector) => {
  const element = findShown(selector)
  return Boolean(element && onScreen(element))
}

// The menus a step can be in: the button opening it (waited for: a page just
// shown may not have it yet), how to tell it's open, open it, close it.
const MENUS = {
  appMenu: {
    opener: '.oc-app-menu',
    isOpen: () => Boolean(findShown('.oc-app-menu-panel')),
    open: () => clickFirst('.oc-app-menu'),
    close: () => clickFirst('.oc-app-menu-panel--close'),
  },
  navDrawer: {
    opener: ['.oc-search-bar--menu', '.oc-app-bar--menu'],
    isOpen: () => Boolean(findShown('.oc-nav-drawer--list')),
    open: () => clickFirst(['.oc-search-bar--menu', '.oc-app-bar--menu']),
    close: () => clickFirst('.oc-nav-drawer--close'),
  },
  filterMenu: {
    opener: '.oc-search-bar--filter',
    isOpen: () => drawerOpen('.oc-filter-menu .MuiDrawer-paper'),
    open: () => clickFirst('.oc-search-bar--filter'),
    close: () => clickFirst('.oc-filter-menu--close'),
  },
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
    // The browser's own language for the app's (no browser is in Yucatec
    // Maya: Spanish), for its captures.
    language: toServiceLanguage(i18n.resolvedLanguage),
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
  // The steps whose Show me was used (their button gone).
  const shownPlaces = new Set()
  // The element pointed at last, and how to put its attributes back.
  let pointed = null
  let restorePointed = () => {}

  const textKey = (step, part) => {
    const variant = step.variant?.(context)
    return `steps.${tour.id}.${step.id}.${variant ? `${variant}.` : ''}${part}`
  }

  // A step's text: its paragraphs (a blank line between them in the
  // translation), each escaped.
  function paragraphs(text) {
    return text.split(/\n\s*\n/).map((paragraph) => `<span class="oc-tour-paragraph">${richText(paragraph.trim())}</span>`).join('')
  }

  // A step's tip (step.tip): a line set apart under its text - where to look,
  // an arrow pointing there.
  function stepTip(step) {
    if (!(typeof step.tip === 'function' ? step.tip(context) : step.tip)) return ''
    // Its picture (step.image, for this context): the control as the browser
    // shows it - none where there's no capture.
    const src = step.image?.(context)
    const image = src ? `<img class="oc-tour-tip-image" src="${escapeHtml(src)}" alt="${escapeHtml(t(textKey(step, 'imageAlt')))}">` : ''
    return `<span class="oc-tour-tip">${richText(t(textKey(step, 'tip')))}${image}</span>`
  }

  const tourDriver = driver({
    steps: steps.map((step, index) => ({
      element: () => elements[index] || undefined,
      popover: {
        title: LINE_ARROW + escapeHtml(t(textKey(step, 'title'))),
        description: paragraphs(t(textKey(step, 'text'))) + stepTip(step),
        // Fixed, or by the device (a function of the context).
        side: typeof step.side === 'function' ? step.side(context) : step.side,
        align: (typeof step.align === 'function' ? step.align(context) : step.align) || (step.target ? 'start' : 'center'),
      },
    })),
    animate: !reducedMotion,
    smoothScroll: !reducedMotion,
    overlayColor: 'var(--oc-tour-scrim)',
    overlayOpacity: 1,
    // A tap beside the popover doesn't end the tour by accident: its close
    // button and Escape do.
    overlayClickBehavior: () => {},
    stagePadding: STAGE_PADDING,
    stageRadius: STAGE_RADIUS,
    popoverOffset: 10,
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
      // A step's pointer (step.pointer): a large arrow outside the popover,
      // the popover moved away to make room (tours.scss) - the popover
      // element is reused from step to step: last step's taken off first.
      popover.wrapper.classList.remove('oc-tour-popover--pointer-up', 'oc-tour-popover--pointer-down')
      popover.wrapper.querySelector('.oc-tour-pointer')?.remove()
      const direction = steps[active]?.pointer?.(context)
      if (direction) {
        popover.wrapper.classList.add(`oc-tour-popover--pointer-${direction}`)
        const pointer = document.createElement('div')
        pointer.className = 'oc-tour-pointer'
        pointer.innerHTML = pointerSvg()
        popover.wrapper.append(pointer)
      }
      popover.progress.textContent = t('progress', { current: active + 1, total: steps.length })
      popover.closeButton.innerHTML = CLOSE_ICON
      popover.closeButton.title = t('buttons.close')
      // A step's Show me: the cave layer on (put back at the end) and the map
      // flown to the place it names - before Back and Next.
      // Once used, it's gone for the rest of the tour (coming back to the step
      // included); the focus then on Next.
      const place = steps[active]?.showMe
      if (place && !shownPlaces.has(active)) {
        const showMe = document.createElement('button')
        showMe.type = 'button'
        showMe.className = 'driver-popover-footer-btn oc-tour-show-me'
        showMe.textContent = t(textKey(steps[active], 'showMe'))
        showMe.addEventListener('click', () => {
          if (!store.getState().caveLayer.visible) {
            caveLayerBefore ??= false
            store.dispatch(setCaveLayerVisible(true))
          }
          store.dispatch(requestFlyToCoordinate({ longitude: place.longitude, latitude: place.latitude, zoom: place.zoom, exact: true }))
          shownPlaces.add(active)
          showMe.remove()
          popover.nextButton.focus()
        })
        popover.footerButtons.prepend(showMe)
      }
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
      // Focus out of it first: closing, it's hidden from assistive tech
      // (aria-hidden) - with the focus still inside, the browser refuses.
      const focused = /** @type {HTMLElement|null} */ (document.activeElement)
      focused?.blur()
      menu.close()
      await waitUntil(() => !menu.isOpen(), CLOSE_TIMEOUT)
    }
  }

  // The phone's result sheet (an Ionic sheet modal: its breakpoints) as a
  // step wants it, and where it was before, to put it back.
  let sheetBefore = null
  const sheetModal = () => /** @type {any} */ (document.querySelector('ion-modal.oc-result-pane-sm'))
  async function setSheet(breakpoint) {
    const modal = sheetModal()
    if (!modal?.setCurrentBreakpoint) return
    if (breakpoint !== null) sheetBefore ??= await modal.getCurrentBreakpoint()
    await modal.setCurrentBreakpoint(breakpoint ?? sheetBefore)
    if (breakpoint === null) sheetBefore = null
  }

  // The page, menu, layer and sheet a step needs.
  async function prepare(step) {
    if (step.open !== openMenu) await closeMenu()
    // A step not raising the sheet: back where it was.
    if (!step.sheet && sheetBefore !== null) await setSheet(null)
    if (step.route && window.location.pathname !== step.route) await navigate(step.route)
    if (step.caveLayer && !store.getState().caveLayer.visible) {
      caveLayerBefore ??= false
      store.dispatch(setCaveLayerVisible(true))
    }
    if (step.sheet && context.phone) {
      // The sheet may still be opening (a cave just navigated to).
      await waitUntil(() => Boolean(sheetModal()), DEFAULT_TIMEOUT)
      await setSheet(step.sheet)
    }
    if (step.open && !MENUS[step.open].isOpen()) {
      // The button opening it may still be on its way (a page just shown).
      await waitForTarget(MENUS[step.open].opener, DEFAULT_TIMEOUT, () => stopped)
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
        const element = step.target ? await waitForTarget(step.target, step.timeout ?? DEFAULT_TIMEOUT, () => stopped, typeof step.scroll === 'function' ? step.scroll(context) : step.scroll) : null
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
    if (sheetBefore !== null) setSheet(null)
    // The markers standing for the browser's own controls (tourSteps.js).
    document.querySelectorAll('.oc-tour-anchor').forEach((anchor) => anchor.remove())
  }

  const controller = { stop }
  current = controller
  go(0, 1)
}
