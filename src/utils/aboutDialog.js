// About opens as a dialog over the page shown (AboutDialog), its address
// /about - the page itself for a visit straight to /about. A link's click
// handler: a plain click opens the dialog; a click meant for a new tab or
// window (modifier keys, middle button) is left to the browser, which opens
// the /about page.
export const OPEN_ABOUT_EVENT = 'oc-open-about'

export function openAboutDialog(event) {
  if (event && (event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return
  // On the About page itself, nothing to open over it.
  if (window.location.pathname.replace(/\/$/, '') === '/about') return
  event?.preventDefault()
  window.dispatchEvent(new Event(OPEN_ABOUT_EVENT))
}
