// What the cave pane's Further reading row and Further reading's own pane
// (FurtherReadingPane, lazy) share, without the row loading the pane.

// The pane's address, under a cave's on the map.
export const READING_PANE_PATH = '/map/:caveId/reading'

// The row asks the open pane to close (a computer's toggle): the pane plays
// its exit, then leaves its address.
export const READING_PANE_CLOSE_EVENT = 'oc-further-reading-pane-close'

/**
 * Asks Further reading's open pane to close, animated (the row's toggle).
 */
export function requestReadingPaneClose() {
  window.dispatchEvent(new Event(READING_PANE_CLOSE_EVENT))
}
