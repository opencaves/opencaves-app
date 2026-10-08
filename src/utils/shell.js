// index.html's splash (#oc-shell), over the page until it has rendered:
// faded out, then removed - at once when the system asks for less motion.
const FADE_MS = 180

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
