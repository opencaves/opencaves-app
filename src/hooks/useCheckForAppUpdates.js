import { useEffect, useState } from 'react'


export function useCheckForAppUpdates(interval = 20 * 60 * 1000 /* 20 minutes */) {

  const [updateAvailable, setUpdateAvailable] = useState(false)
  console.log('Launching the check for updates process')
  useEffect(() => {

    if (!('serviceWorker' in navigator)) {
      return
    }

    let timeout
    let serviceWorker

    //adding listen to newWork activated state, prevents setUpdateAvailable being called when user clicks refresh
    const processUpdate = event => {
      console.log('[serviceWorker] Update found!')
      const newWorker = serviceWorker.installing
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          console.log('[serviceWorker] Update: state changed: %s', newWorker.state)
          if (newWorker.state === 'activated') {
            setUpdateAvailable(true)
          }
        })
      }
      return
    }

    const checkForUpdates = (serviceWorker) => {
      if (!serviceWorker) {
        return
      }

      function p(n) { return `${n}`.padStart(2, '0') }
      const now = new Date()
      console.log(`[serviceWorker] ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())} Checking for update...`)
      serviceWorker.update()
      timeout = setTimeout(() => checkForUpdates(serviceWorker), interval)
    }

    navigator.serviceWorker.ready.then(function (sw) {
      serviceWorker = sw
      serviceWorker.addEventListener('updatefound', processUpdate)
      timeout = setTimeout(() => checkForUpdates(serviceWorker), interval)
    })

    return () => {
      clearTimeout(timeout)
      if (serviceWorker) {
        serviceWorker.removeEventListener('updatefound', processUpdate)
      }
    }
  }, [interval])

  return updateAvailable
}