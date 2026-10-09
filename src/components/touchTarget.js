// M3's 48 dp touch target for a control drawn smaller (an X, a "#", a small
// link): an invisible area around it, centred, that takes the taps - the
// control's look and the layout stay as they are (as the Feedback tab does).
// Icon buttons get theirs from the theme (MuiIconButton).
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

