// Only files dragged in from outside the page (the desktop, another app) start
// the "drop to add" process. Dragging one of the page's own pictures (a
// gallery thumbnail) also says it carries "Files" in Chrome, so drags that
// start in the page are tracked and, when they carry files, stopped at the
// window (capture phase) before any drop zone sees them - the app's own and
// react-dropzone's alike. The page's other drags (the coordinate fields'
// swap, which carries no file) go through untouched.
let dragFromPage = false

function stopPageFileDrag(event) {
  if (dragFromPage && event.dataTransfer?.types?.includes('Files')) event.stopPropagation()
}

if (typeof window !== 'undefined') {
  window.addEventListener('dragstart', () => (dragFromPage = true), true)
  window.addEventListener('dragend', () => (dragFromPage = false), true)
  for (const type of ['dragenter', 'dragover', 'dragleave', 'drop']) window.addEventListener(type, stopPageFileDrag, true)
  // After the stop above (same phase, added later): the drag is over.
  window.addEventListener('drop', () => (dragFromPage = false), true)
}

export function isExternalFileDrag(event) {
  return !dragFromPage && Boolean(event.dataTransfer?.types?.includes('Files'))
}
