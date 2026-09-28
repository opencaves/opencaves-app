import { useState, useCallback, useEffect } from 'react'
import * as serviceWorkerRegistration from '../serviceWorkerRegistration'

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

  // Tells the waiting service worker to take over, and reloads once it has:
  // reloading right away could still be served by the old one.
  const reloadPage = useCallback(() => {
    setShowReload(false)
    if (!waitingWorker || !navigator.serviceWorker?.controller) {
      window.location.reload()
      return
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }, [waitingWorker])

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
