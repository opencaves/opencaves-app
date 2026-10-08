// M3's 48 dp touch target for a control drawn smaller (an X, a "#", a small
// link): an invisible area around it, centred, that takes the taps - the
// control's look and the layout stay as they are (as the Feedback tab does).
export const TOUCH_TARGET_SX = {
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '100%',
    height: '100%',
    minWidth: 48,
    minHeight: 48,
    transform: 'translate(-50%, -50%)',
  },
}

// Small icon buttons side by side (a toolbar): on a touch screen, padded up
// to 48 px each, since invisible areas would overlap their neighbours.
export const COARSE_POINTER_ICON_BUTTONS_SX = {
  '@media (pointer: coarse)': { '& .MuiIconButton-root': { padding: '12px' } },
}
