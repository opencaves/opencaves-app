import { useLayoutEffect, useState } from 'react'
import { Box, Modal } from '@mui/material'

// A page's gallery (PhotoGallery, MapGallery): over the whole window, above
// the page it belongs to, which stays under it. A modal: focus kept inside,
// the page hidden from screen readers and still, Escape closes it.
export default function GalleryOverlay({ className, onClose, children }) {
  // Opened once the link that led here has let go of focus: the modal hides
  // the page (aria-hidden on #root) before taking focus, which the browser
  // blocks while that link still has it.
  const [open, setOpen] = useState(false)
  useLayoutEffect(() => {
    document.activeElement?.blur()
    setOpen(true)
  }, [])

  return (
    <Modal className={['oc-gallery-overlay', className].filter(Boolean).join(' ')} open={open} onClose={onClose} slotProps={{ backdrop: { sx: { bgcolor: '#000' } } }}>
      <Box className="oc-gallery-overlay--content" sx={{ position: 'fixed', inset: 0, display: 'flex', bgcolor: '#000', outline: 'none' }}>
        {children}
      </Box>
    </Modal>
  )
}
