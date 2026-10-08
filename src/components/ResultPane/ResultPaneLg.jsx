import React, { useContext, useLayoutEffect, useRef } from 'react'
import { Scrollbars } from 'react-custom-scrollbars-3'
import { Card, CardContent } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { PANE_WIDTH, RESULT_PANE_MIN_HEIGHT } from '@/config/app.js'
import { ResultPaneExitContext } from './resultPaneExit.js'
import './ResultPaneLg.scss'

export default function ResultPaneLg({ children, editMode, cave, ...props }) {
  const theme = useTheme()
  const scrollbarsRef = useRef(null)
  const cardRef = useRef(null)
  // Set while the pane closes (ResultPaneOutlet): shrink, then call it.
  const onExited = useContext(ResultPaneExitContext)
  const exiting = Boolean(onExited)

  // Another cave opens at the top, not where the last one was scrolled to.
  useLayoutEffect(() => {
    scrollbarsRef.current?.scrollToTop()
  }, [cave?.id])

  const widthTransition = theme.transitions.create('max-width', {
    duration: theme.oc.sys.motion.duration.emphasized,
    easing: theme.sys.motion.easing.emphasizedDecelerate,
  })
  const { duration } = theme.oc.sys.motion
  const { easing } = theme.sys.motion
  // M3: entering (opening), leaving (closing), and resizing in place.
  const openTransition = theme.transitions.create('height', { duration: duration.emphasizedDecelerate, easing: easing.emphasizedDecelerate })
  const closeTransition = theme.transitions.create('height', { duration: duration.emphasizedAccelerate, easing: easing.emphasizedAccelerate })
  const resizeTransition = theme.transitions.create('height', { duration: duration.standard, easing: easing.standard })

  // The card's height follows its content's (the Scrollbars' container, which
  // sizes itself: content height capped at the viewport's, or the full
  // viewport in edit mode) through an explicit, transitioned height: it
  // grows from 0 when the pane opens, shrinks back to 0 when it closes, and
  // eases between heights as the content changes. The card clips what's
  // taller meanwhile; scrolling stays the Scrollbars' own.
  const exitingRef = useRef(exiting)
  exitingRef.current = exiting
  const transitionsRef = useRef()
  transitionsRef.current = { widthTransition, openTransition, closeTransition, resizeTransition }
  const setHeightRef = useRef(null)

  useLayoutEffect(() => {
    const card = cardRef.current
    const container = scrollbarsRef.current?.container
    if (!card || !container) return
    let current = 0
    let started = false

    const setHeight = (target) => {
      if (target === current) return
      const { widthTransition, openTransition, closeTransition, resizeTransition } = transitionsRef.current
      const heightTransition = target === 0 ? closeTransition : current === 0 ? openTransition : resizeTransition
      card.style.transition = `${widthTransition}, ${heightTransition}`
      card.style.height = `${target}px`
      current = target
    }
    const update = () => {
      if (started) setHeight(exitingRef.current ? 0 : Math.max(container.getBoundingClientRect().height, RESULT_PANE_MIN_HEIGHT))
    }
    setHeightRef.current = update

    // Started two frames later, once the new content has painted: started
    // with it (the pane's mount, another cave's), a transition's first frames
    // went to that render's own work, and it seemed to jump.
    // One pending at a time: a section animating its own height resizes
    // the content every frame.
    let frame = null
    const updateLater = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          frame = null
          update()
        })
      })
    }

    // Opening: grows from 0.
    card.style.height = '0px'
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        frame = null
        started = true
        update()
      })
    })

    const observer = new ResizeObserver(() => {
      if (started) updateLater()
    })
    observer.observe(container)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      setHeightRef.current = null
    }
  }, [])

  // Closing: shrinks to 0, then lets it unmount (back to the content's
  // height if another cave opens meanwhile).
  useLayoutEffect(() => {
    setHeightRef.current?.()
    if (!onExited) return
    const card = cardRef.current
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || card.getBoundingClientRect().height === 0) {
      onExited()
      return
    }
    const done = (event) => {
      if (!event || (event.target === card && event.propertyName === 'height')) onExited()
    }
    card.addEventListener('transitionend', done)
    // Should the transition never end (interrupted, hidden tab).
    const timer = window.setTimeout(done, duration.emphasizedAccelerate + 300)
    return () => {
      card.removeEventListener('transitionend', done)
      window.clearTimeout(timer)
    }
  }, [onExited, duration.emphasizedAccelerate])

  return (
    <Card
      {...props}
      ref={cardRef}
      className="oc-result-pane oc-result-pane-lg"
      sx={{
        position: 'relative',
        boxShadow: 5,
        '.MuiCardContent-root': {
          p: 0,
        },
        maxWidth: editMode ? `min(${PANE_WIDTH * 2}px, 80vw)` : `${PANE_WIDTH}px`,
        transition: widthTransition,
        '@media (prefers-reduced-motion: reduce)': { transition: 'none !important' },
      }}
      component="main"
    >
      <Scrollbars
        ref={scrollbarsRef}
        autoHide
        autoHeight
        // In edit mode, force the scrollable area to always fill the full
        // viewport height (not just cap there) so the pane elongates even
        // when the form's content is short, instead of only growing up to
        // content height like the read-only view does.
        autoHeightMin={editMode ? '100vh' : 0}
        autoHeightMax="100vh"
        // Above the pane's sticky headers (the Sistema accordion's, z-index 1).
        renderTrackVertical={({ style, ...props }) => <div {...props} style={{ ...style, position: 'absolute', width: 6, right: 2, bottom: 2, top: 2, borderRadius: 3, zIndex: 2 }} />}
        renderThumbVertical={({ style, ...props }) => (
          <div
            {...props}
            style={{
              ...style,
              cursor: 'pointer',
              borderRadius: 'inherit',
              backgroundColor: 'var(--oc-scrollbar-thumb)',
            }}
          />
        )}
      >
        <CardContent
          sx={{
            p: 0,
          }}
        >
          {children}
        </CardContent>
      </Scrollbars>
    </Card>
  )
}
