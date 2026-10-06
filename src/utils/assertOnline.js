import i18n from 'i18next'

// For what can't wait for the connection to come back - a server function
// (undo, emptying the trash, managing users) or an upload: throws right away
// when the device is offline, instead of hanging until the request times out.
// The error's message says why, translated; its code is 'offline'.
export function assertOnline() {
  if (typeof navigator === 'undefined' || navigator.onLine !== false) return
  const error = new Error(i18n.t('app:snackbar.needsConnection'))
  error.code = 'offline'
  throw error
}
