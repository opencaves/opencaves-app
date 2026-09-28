import { useEffect, useState } from 'react'

export function useCheckForAppUpdates(interval = 20 * 60 * 1000 /* 20 minutes */) {

  const [updateAvailable, setUpdateAvailable] = useState(false)
  // console.log('Launching the check for updates process')
  useEffect(() => {

    if (!('serviceWorker' in navigator)) {
      return
    }

    let timeout
    let serviceWorker

    //adding listen to newWork activated state, prevents setUpdateAvailable being called when user clicks refresh
    const processUpdate = event => {
      const newWorker = serviceWorker.installing
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
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