export const drawerWidth = 400
export const mediaItemPadding = 14
export const mediaItemRadius = '.75rem'

// The photo and map viewers' "3 / 12" (the lightbox's Counter plugin): at the
// bottom right, 16px in from the corner (above a phone's home bar), its line
// as tall as a caption's - on the map viewer it sits at the end of the
// caption's band, whose text leaves it room (LIGHTBOX_COUNTER_ROOM).
export const LIGHTBOX_COUNTER = {
  container: {
    style: {
      top: 'auto',
      left: 'auto',
      bottom: 'env(safe-area-inset-bottom, 0px)',
      right: 0,
      margin: '16px',
      padding: 0,
      lineHeight: '20px',
    },
  },
}

// The room a caption's text leaves the counter at its right end.
export const LIGHTBOX_COUNTER_ROOM = 72
