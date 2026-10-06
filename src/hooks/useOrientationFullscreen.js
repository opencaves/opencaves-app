import { useEffect, useRef, useState } from 'react'

// How long to wait for a full-screen request before falling back.
const FULLSCREEN_CHECK_MS = 400

// In the installed app (PWA) on a touch device, a gallery follows the phone:
// turned sideways, its viewer goes full screen (and turns with the phone:
// the manifest allows any orientation); upright again, it leaves full screen
// - but only a full screen the turn itself entered: one the person chose
// (the viewer's button, before turning) stays. Also when the gallery opens
// already sideways. fullscreenRef: the lightbox's Fullscreen plugin ref
// (enter, exit, fullscreen).
//
// A browser may refuse full screen without a tap (turning the phone isn't
// one): the viewer then covers the whole app window instead - `immersive`,
// for the caller to style - which, in an installed app with no browser bar,
// looks the same but for the phone's status bar.
export function useOrientationFullscreen(fullscreenRef) {
  const [immersive, setImmersive] = useState(false)
  // Whether the current full screen (or immersive view) came from a turn.
  const byRotation = useRef(false)

  useEffect(() => {
    const installed = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)')
    const touch = window.matchMedia('(pointer: coarse)')
    const landscape = window.matchMedia('(orientation: landscape)')
    let timer = null

    function apply() {
      if (!installed.matches || !touch.matches) return
      const fullscreen = fullscreenRef.current
      clearTimeout(timer)
      if (landscape.matches) {
        // Already full screen (the person's choice): left as it is, theirs.
        if (document.fullscreenElement || fullscreen?.fullscreen) return
        byRotation.current = true
        fullscreen?.enter()
        timer = setTimeout(() => setImmersive(!document.fullscreenElement), FULLSCREEN_CHECK_MS)
      } else if (byRotation.current) {
        byRotation.current = false
        if (document.fullscreenElement) fullscreen?.exit()
        setImmersive(false)
      }
    }

    // Full screen left another way (the back gesture, the viewer's button)
    // while sideways: no longer the turn's to undo.
    function onFullscreenChange() {
      if (!document.fullscreenElement && byRotation.current && landscape.matches) {
        byRotation.current = false
        setImmersive(false)
      }
    }

    apply()
    landscape.addEventListener('change', apply)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      clearTimeout(timer)
      landscape.removeEventListener('change', apply)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [fullscreenRef])

  return immersive
}
