import { useEffect, useRef, useState } from 'react'
import { Box, CircularProgress } from '@mui/material'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'

const MIN_SCALE = 1
const MAX_SCALE = 5
const CLICK_ZOOM_STEP = 1

// A large, zoomable/pannable preview of a map file, shown in the map details
// form so the person confirming a title/authors can actually make out
// details on the map - important since survey maps are often dense and a
// static thumbnail alone isn't enough. Covers three cases:
//  - a not-yet-uploaded local `file` (new map)
//  - an already-uploaded map with a ready vector preview (`existingUrl` is
//    that preview - pass no `existingContentType` so it's treated as an image)
//  - an already-uploaded PDF map whose server-side conversion hasn't
//    finished yet (`existingUrl` is the original PDF, `existingContentType`
//    is 'application/pdf') - the original is fetched and converted
//    client-side too, so editing still shows something better than a bare
//    icon in that (usually brief) window.
// A PDF is converted to SVG with the same pdf-into-svg conversion the server
// runs for the permanent preview, so this looks the same; it takes a
// moment, hence the spinner while that's in progress. Images (and already-
// converted previews) show instantly.
export default function PendingFilePreview({ file, existingUrl, existingContentType, width = 200, height = 200 }) {
  const [objectUrl, setObjectUrl] = useState(null)
  const [convertingPdf, setConvertingPdf] = useState(false)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [shiftPressed, setShiftPressed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)
  const draggingRef = useRef(null)
  const draggedRef = useRef(false)

  // Tracked purely to flip the cursor between zoom-in/zoom-out - the actual
  // click handler reads event.shiftKey directly, it doesn't need this.
  useEffect(() => {
    function onKeyChange(event) {
      setShiftPressed(event.shiftKey)
    }
    window.addEventListener('keydown', onKeyChange)
    window.addEventListener('keyup', onKeyChange)
    return () => {
      window.removeEventListener('keydown', onKeyChange)
      window.removeEventListener('keyup', onKeyChange)
    }
  }, [])

  const existingIsImage = !!existingUrl && (!existingContentType || existingContentType.startsWith('image/'))

  useEffect(() => {
    setScale(1)
    setPan({ x: 0, y: 0 })
    setObjectUrl(null)
    setConvertingPdf(false)

    let cancelled = false
    let createdUrl = null

    async function convertPdf(pdfSource) {
      setConvertingPdf(true)
      try {
        const { convertPdfToSvg } = await import('pdf-into-svg')
        const result = await convertPdfToSvg(pdfSource, { pages: [1], includeAnnotations: false, includeLinks: false })
        const svg = result.pages[0]?.svg
        if (!svg || cancelled) return
        createdUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
        setObjectUrl(createdUrl)
      } catch (error) {
        console.warn('Could not generate a PDF map preview', error)
      } finally {
        if (!cancelled) setConvertingPdf(false)
      }
    }

    if (file) {
      if (file.type.startsWith('image/')) {
        createdUrl = URL.createObjectURL(file)
        setObjectUrl(createdUrl)
      } else if (file.type === 'application/pdf') {
        convertPdf(file)
      }
    } else if (existingUrl && !existingIsImage) {
      fetch(existingUrl)
        .then((response) => response.blob())
        .then((blob) => (cancelled ? null : convertPdf(blob)))
        .catch((error) => console.warn('Could not fetch PDF map for preview', error))
    }

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, existingUrl, existingIsImage])

  const previewUrl = file ? objectUrl : existingIsImage ? existingUrl : objectUrl

  function clampPan(next, nextScale) {
    // Keeps the image from being dragged so far that empty space shows -
    // the max offset grows with how much the image has been zoomed in.
    const maxOffset = ((nextScale - 1) / 2) * Math.min(width, height)
    return {
      x: Math.max(-maxOffset, Math.min(maxOffset, next.x)),
      y: Math.max(-maxOffset, Math.min(maxOffset, next.y)),
    }
  }

  // React's onWheel prop is attached as a passive listener, so
  // event.preventDefault() inside it silently does nothing - the dialog
  // behind the image would scroll at the same time as it zoomed. Attaching
  // the listener manually as non-passive (same fix already used for the
  // horizontal media scrollers elsewhere in this pane) is required to
  // actually stop that.
  useEffect(() => {
    const container = containerRef.current
    if (!container || !previewUrl) return undefined

    function onWheel(event) {
      event.preventDefault()
      setScale((current) => {
        const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, current - event.deltaY * 0.01))
        setPan((currentPan) => clampPan(currentPan, nextScale))
        return nextScale
      })
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl, width, height])

  function handlePointerDown(event) {
    if (!previewUrl || scale <= 1) return
    draggingRef.current = { startX: event.clientX, startY: event.clientY, startPan: pan }
    draggedRef.current = false
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event) {
    if (!draggingRef.current) return
    const { startX, startY, startPan } = draggingRef.current
    // A couple pixels of slop before it counts as a drag, so the following
    // click (browsers still fire one after a small-movement mousedown/up
    // pair) isn't mistaken for a pan and treated as a zoom click too.
    if (Math.abs(event.clientX - startX) > 3 || Math.abs(event.clientY - startY) > 3) {
      draggedRef.current = true
    }
    setPan(clampPan({ x: startPan.x + (event.clientX - startX), y: startPan.y + (event.clientY - startY) }, scale))
  }

  function handlePointerUp() {
    draggingRef.current = null
    setIsDragging(false)
  }

  // Click zooms in centered on the clicked point, one step at a time;
  // shift-click zooms back out the same way - the cursor (zoom-in/zoom-out)
  // advertises which one a click will do. Ignored right after a drag-to-pan
  // gesture, which also ends in a click.
  function handleClick(event) {
    if (!previewUrl || draggedRef.current) {
      draggedRef.current = false
      return
    }

    const zoomingOut = event.shiftKey
    const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + (zoomingOut ? -CLICK_ZOOM_STEP : CLICK_ZOOM_STEP)))
    if (nextScale === 1) {
      setScale(1)
      setPan({ x: 0, y: 0 })
      return
    }

    const rect = containerRef.current.getBoundingClientRect()
    const offsetX = event.clientX - (rect.left + rect.width / 2)
    const offsetY = event.clientY - (rect.top + rect.height / 2)
    setScale(nextScale)
    setPan((currentPan) => {
      // Zooming in centers on the click point; zooming out just scales the
      // existing pan down proportionally rather than re-centering on it.
      const base = zoomingOut ? currentPan : { x: -offsetX * (nextScale - 1), y: -offsetY * (nextScale - 1) }
      return clampPan(zoomingOut ? { x: base.x * (nextScale / scale), y: base.y * (nextScale / scale) } : base, nextScale)
    })
  }

  if (!file && !existingUrl) {
    return null
  }

  return (
    <Box
      ref={containerRef}
      className="oc-pending-file-preview"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={handleClick}
      sx={{
        // Fills whatever box the caller sizes (width/height are only used
        // for the pan-clamping math below, in clampPan), so the preview
        // always fits its container instead of being a fixed pixel size.
        width: '100%',
        height: '100%',
        borderRadius: 1,
        overflow: 'hidden',
        flexShrink: 0,
        bgcolor: 'action.hover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid',
        borderColor: 'divider',
        touchAction: 'none',
        cursor: previewUrl ? (isDragging ? 'grabbing' : shiftPressed ? 'zoom-out' : 'zoom-in') : 'default',
      }}
    >
      {previewUrl ? (
        <Box
          component="img"
          src={previewUrl}
          alt=""
          crossOrigin="anonymous"
          draggable={false}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transition: draggingRef.current ? 'none' : 'transform 0.1s ease-out',
          }}
        />
      ) : convertingPdf ? (
        <CircularProgress size={32} />
      ) : (
        <PictureAsPdfRounded color="primary" sx={{ fontSize: 64 }} />
      )}
    </Box>
  )
}
