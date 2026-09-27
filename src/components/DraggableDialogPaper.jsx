import { useRef } from 'react'
import Draggable from 'react-draggable'
import { Paper } from '@mui/material'

// A Dialog's PaperProps.component, letting the dialog be dragged around by
// its title bar - handy once a dialog (like the map upload/edit ones) is
// wide enough to cover most of the screen and something behind it needs a
// peek. Bounded to `handle` so dragging only starts from the title, not
// anywhere in the form.
export default function DraggableDialogPaper(props) {
  const nodeRef = useRef(null)

  return (
    <Draggable nodeRef={nodeRef} handle=".oc-draggable-dialog--handle" cancel='[class*="MuiDialogContent-root"]'>
      <Paper {...props} ref={nodeRef} />
    </Draggable>
  )
}
