import { useState, useCallback, useEffect } from 'react'
import * as serviceWorkerRegistration from '../serviceWorkerRegistration'

// How long Refresh waits for the new version to take over before reloading
// anyway (a version that installs slowly, or never answers).
const SWITCH_TIMEOUT_MS = 10000

/**
 * Registers the service worker, and tells when a new version is waiting
 * (showReload, waitingWorker) and how to switch to it (reloadPage).
 *
 * @returns {{showReload: boolean, waitingWorker: ServiceWorker|null, reloadPage: () => Promise<void>}}
 */
export const useServiceWorker = () => {
  const [waitingWorker, setWaitingWorker] = useState(null)
  const [showReload, setShowReload] = useState(false)

  // called when a service worker
  // updates. this function is a callback
  // to the actual service worker
  // registration onUpdate.
  const onSWUpdate = useCallback(registration => {
    setShowReload(true)
    setWaitingWorker(registration.waiting)
  }, [])

  // Tells the version waiting now to take over, and reloads once it has:
  // reloading right away could still be served by the old one. The version
  // waiting now, asked for at the click - not the one known when the message
  // showed: an app left open through two updates kept a version the browser
  // had since dropped, which never answered (Refresh did nothing). None
  // waiting: one installing is waited for, else the page just reloads. And
  // whatever happens, it reloads after SWITCH_TIMEOUT_MS.
  const reloadPage = useCallback(async () => {
    setShowReload(false)
    const container = navigator.serviceWorker
    if (!container?.controller) {
      window.location.reload()
      return
    }
    let reloaded = false
    const reload = () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    }
    container.addEventListener('controllerchange', reload, { once: true })
    setTimeout(reload, SWITCH_TIMEOUT_MS)
    const takeOver = (worker) => worker.postMessage({ type: 'SKIP_WAITING' })
    try {
      const registration = await container.getRegistration()
      if (registration?.waiting) {
        takeOver(registration.waiting)
        return
      }
      const installing = registration?.installing
      if (installing) {
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed') takeOver(installing)
          else if (installing.state === 'redundant') reload()
        })
        return
      }
      reload()
    } catch {
      reload()
    }
  }, [])

  // register the service worker
  useEffect(() => {
    // If you want your app to work offline and load faster, you can change
    // unregister() to register() below. Note this comes with some pitfalls.
    // Learn more about service workers: https://cra.link/PWA
    serviceWorkerRegistration.register({
      onUpdate: onSWUpdate
    })
  }, [onSWUpdate])

  return { showReload, waitingWorker, reloadPage }
}
