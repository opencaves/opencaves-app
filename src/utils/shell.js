// index.html's splash (#oc-shell), over the page until it has rendered:
// faded out, then removed - at once when the system asks for less motion.
const FADE_MS = 180

// The cave name index.html's splash shows (from the server's text), and the
// address it was for: read before the splash goes, for MapLoading to keep.
// (None on the server, which renders the public pages: entry-server.jsx.)
const splash = typeof document === 'undefined' ? null : document.getElementById('oc-shell')
const shellCave = { name: splash?.dataset.caveName, path: splash?.dataset.path }

export function shellCaveName() {
  return shellCave.path === window.location.pathname ? shellCave.name : undefined
}

export function removeShell() {
  const shell = document.getElementById('oc-shell')
  if (!shell || shell.classList.contains('oc-shell--out')) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    shell.remove()
    return
  }
  shell.classList.add('oc-shell--out')
  setTimeout(() => shell.remove(), FADE_MS)
}
