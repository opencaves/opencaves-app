import { useEffect, useState } from 'react'

// How long to wait for a full-screen request before falling back.
const FULLSCREEN_CHECK_MS = 400

// In the installed app (PWA) on a touch device, a gallery follows the phone:
// turned sideways, its viewer goes full screen; upright again, it leaves it.
// Also when the gallery opens already sideways. fullscreenRef: the
// lightbox's Fullscreen plugin ref (enter, exit, fullscreen).
//
// A browser may refuse full screen without a tap (turning the phone isn't
// one): the viewer then covers the whole app window instead - `immersive`,
// for the caller to style - which, in an installed app with no browser bar,
// looks the same but for the phone's status bar.
export function useOrientationFullscreen(fullscreenRef) {
  const [immersive, setImmersive] = useState(false)

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
        fullscreen?.enter()
        timer = setTimeout(() => setImmersive(!document.fullscreenElement), FULLSCREEN_CHECK_MS)
      } else {
        fullscreen?.exit()
        setImmersive(false)
      }
    }

    apply()
    landscape.addEventListener('change', apply)
    return () => {
      clearTimeout(timer)
      landscape.removeEventListener('change', apply)
    }
  }, [fullscreenRef])

  return immersive
}
