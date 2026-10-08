import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Alert, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Skeleton, Tooltip, Typography } from '@mui/material'
import CloseRounded from '@mui/icons-material/CloseRounded'
import PhotoLibraryRounded from '@mui/icons-material/PhotoLibraryRounded'
import { Grid } from '@mui/material'
import Scrollbars from '@/components/Scrollbars/Scrollbars.jsx'
import Picture from '@/components/Picture.jsx'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'
import { deleteById, useCaveAssetsList } from '@/models/CaveAsset.js'
import { useImage } from '@/hooks/useImage.jsx'
import { ASSETS_LIST_CONFIG } from '@/config/resultPane.js'
import { SCROLLBAR_STEP_FACTOR, SCROLLBAR_TRACK_HEIGHT } from '@/config/app.js'

// The strip wrapped around a vertical cylinder, its axis at the middle of
// the strip's visible area, its radius half that area's width: the photos
// bend away on its surface, out of sight past its sides. Each photo is drawn
// as narrow vertical slices (CYLINDER_SLICE px), each set on the curve; the
// real links stay under them, invisible, turned as their column's middle.
const CYLINDER_SLICE = 4
const CYLINDER_PERSPECTIVE = 900
// The cylinder brought toward us: its front this much larger than the flat
// strip (the strip taller by as much, so nothing is cut off).
const CYLINDER_ZOOM = 1.25
// Its front flattened: a flat band this share of the strip's width, the
// curve starting from its edges in line with it (no crease).
const CYLINDER_FLAT = 1 / 5
// The flat strip for reduced motion.
const cylinderOn = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches

// The primary's darker tone, its lighter one in dark mode.
const primaryToneSx = (theme) => ({ color: theme.vars.palette.primary.dark, ...theme.applyStyles('dark', { color: theme.vars.palette.primary.light }) })

// photoPath(id): a photo's address (a page's gallery); the map's viewer otherwise.
export default function MediaList({ caveId, editable = false, photoPath, sx, className, ...props }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  // Deleting a photo: admins only (as in firestore.rules).
  const canDelete = useSelector((state) => state.session.roles.includes('admin'))
  const [mediaList, loading, error] = useCaveAssetsList(caveId)
  const [assetsList, setAssetsList] = useState(null)
  const [pictureToDelete, setPictureToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const { height: assetsListHeight, maxLength: assetsListMaxLength } = ASSETS_LIST_CONFIG
  const scrollbarsRef = useRef()
  const rowRef = useRef()
  const sliceLayerRef = useRef()
  // Above and below the strip: room for the zoomed cylinder.
  const zoomRoom = cylinderOn() ? Math.ceil((assetsListHeight * (CYLINDER_ZOOM - 1)) / 2) : 0

  function closeDeleteDialog() {
    if (deleting) return
    setPictureToDelete(null)
    setDeleteError(false)
  }

  async function handleDelete() {
    if (!canDelete || !pictureToDelete) return

    setDeleting(true)
    setDeleteError(false)
    try {
      await deleteById(pictureToDelete.id)
      setPictureToDelete(null)
    } catch (error) {
      console.error(error)
      setDeleteError(true)
    } finally {
      setDeleting(false)
    }
  }

  function getColPosition(i) {
    const triplets = Math.ceil((i + 1) / 3) - 1
    const secondCol = i % 3 > 0 ? 1 : 0
    return triplets * 2 + secondCol
  }

  useEffect(() => {
    const scrollbar = scrollbarsRef.current
    const container = scrollbar?.container
    if (!container) return undefined

    function onWheel(event) {
      event.preventDefault()
      const { scrollLeft, scrollWidth, clientWidth } = scrollbar.getValues()
      const width = scrollWidth - clientWidth
      const delta = event.deltaY || event.deltaX
      const wheelDirection = Math.sign(delta)
      if (!wheelDirection || width <= 0) {
        return
      }

      if ((wheelDirection < 0 && Math.round(scrollLeft) <= 0) || (wheelDirection > 0 && Math.round(scrollLeft) >= width)) {
        return
      }

      // Snapping (the cylinder): a native scroll, which the browser takes to
      // the next column that way.
      if (scrollbar.view.style.scrollSnapType) {
        scrollbar.view.scrollBy({ left: wheelDirection, behavior: 'smooth' })
        return
      }

      const scrollStep = SCROLLBAR_STEP_FACTOR * wheelDirection
      const func = wheelDirection > 0 ? Math.min : Math.max
      const clampValue = wheelDirection > 0 ? width : 0
      const newScrollLeft = scrollLeft + scrollStep
      const clampedScrollLeft = func(clampValue, newScrollLeft)

      scrollbar.scrollLeft(clampedScrollLeft)
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [mediaList])

  // The cylinder (CYLINDER_SLICE): its slices made again when the photos or
  // the sizes change, placed again on each scroll - straight on the DOM, no
  // re-render. Flat for reduced motion.
  useEffect(() => {
    const view = scrollbarsRef.current?.view
    const row = rowRef.current
    const layer = sliceLayerRef.current
    if (!view || !row || !layer || !cylinderOn()) return undefined

    // An element's place in the row as laid out (offsets ignore transforms).
    function rowOffset(element) {
      let x = 0
      let y = 0
      for (let e = element; e && e !== row; e = e.offsetParent) {
        x += e.offsetLeft
        y += e.offsetTop
      }
      return { x, y }
    }

    let slices = []
    let images = []
    let tiles = []
    function build() {
      layer.replaceChildren()
      slices = []
      // CSS scroll snapping on each column's middle. Its snap points are the
      // targets' transformed boxes: the turned columns would shift them, so
      // they're invisible guides at each column's flat place instead.
      for (const column of row.children) {
        if (column === layer) continue
        const guide = document.createElement('div')
        Object.assign(guide.style, { position: 'absolute', left: `${rowOffset(column).x}px`, top: '0', width: `${column.offsetWidth}px`, height: '1px', scrollSnapAlign: 'center' })
        layer.append(guide)
      }
      // The "more photos" tile: each slice a copy of it, clipped to its strip.
      tiles = [...row.querySelectorAll('.oc-media-list--more')]
      for (const tile of tiles) {
        tile.style.opacity = ''
        const { x, y } = rowOffset(tile)
        const w = tile.offsetWidth
        const h = tile.offsetHeight
        for (let sx = 0; sx < w; sx += CYLINDER_SLICE) {
          const sw = Math.min(CYLINDER_SLICE, w - sx)
          const slice = document.createElement('div')
          // Exactly its width: its background is see-through, an overlap would
          // show darker seams.
          Object.assign(slice.style, { position: 'absolute', left: `${x + sx}px`, top: `${y}px`, width: `${sw}px`, height: `${h}px`, overflow: 'hidden', backfaceVisibility: 'hidden' })
          const copy = tile.cloneNode(true)
          copy.removeAttribute('href')
          copy.tabIndex = -1
          Object.assign(copy.style, { position: 'absolute', left: `${-sx}px`, top: '0' })
          slice.append(copy)
          layer.append(slice)
          slices.push({ slice, x: x + sx + sw / 2 })
        }
        tile.style.opacity = '0'
      }
      images = [...row.querySelectorAll('.oc-media-list--picture img')]
      for (const img of images) {
        const box = img.closest('.oc-media-list--picture')
        const src = img.currentSrc
        if (!src || !img.naturalWidth) continue
        const { x, y } = rowOffset(box)
        const w = box.offsetWidth
        const h = box.offsetHeight
        // As object-fit: cover.
        const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
        const bw = img.naturalWidth * scale
        const bh = img.naturalHeight * scale
        const count = Math.ceil(w / CYLINDER_SLICE)
        for (let i = 0; i < count; i++) {
          const sx = i * CYLINDER_SLICE
          const sw = Math.min(CYLINDER_SLICE, w - sx)
          const slice = document.createElement('div')
          // A hair wider: no seams between slices.
          Object.assign(slice.style, {
            position: 'absolute',
            left: `${x + sx}px`,
            top: `${y}px`,
            width: `${sw + 0.5}px`,
            height: `${h}px`,
            backgroundImage: `url("${src}")`,
            backgroundSize: `${bw}px ${bh}px`,
            backgroundPosition: `${(w - bw) / 2 - sx}px ${(h - bh) / 2}px`,
            backfaceVisibility: 'hidden',
            borderRadius: i === 0 ? '.5rem 0 0 .5rem' : i === count - 1 ? '0 .5rem .5rem 0' : '0',
          })
          layer.append(slice)
          slices.push({ slice, x: x + sx + sw / 2 })
        }
        img.style.opacity = '0'
      }
    }

    // Where a point of the flat strip lands on the cylinder: its arc from the
    // middle is its distance on the strip. Flat across the front band, then
    // round, the curve's radius such that the sides reach the strip's edges.
    // Forward by as much as makes its front CYLINDER_ZOOM times larger.
    const forward = CYLINDER_PERSPECTIVE * (1 - 1 / CYLINDER_ZOOM)
    function place(x, center, radius) {
      const flat = (radius * 2 * CYLINDER_FLAT) / 2
      const bend = radius - flat
      const distance = x - center
      const side = Math.sign(distance)
      const theta = Math.max(0, Math.abs(distance) - flat) / bend
      const shift = side * (Math.min(Math.abs(distance), flat) + bend * Math.sin(theta)) + center - x
      const depth = forward + bend * (Math.cos(theta) - 1)
      return { theta, transform: `translate3d(${shift}px, 0, ${depth}px) rotateY(${-side * theta}rad)` }
    }

    let frame
    let stale = true
    function layout() {
      frame = undefined
      if (stale) {
        // Room before the first column and after the last: either can be
        // scrolled to the middle - the strip starts on the first one there.
        const columns = [...row.children].filter((column) => column !== layer)
        const padding = parseFloat(getComputedStyle(row.parentElement).paddingLeft) || 0
        row.style.marginLeft = `${Math.max(0, view.clientWidth / 2 - columns[0].offsetWidth / 2 - padding)}px`
        row.style.marginRight = `${Math.max(0, view.clientWidth / 2 - columns.at(-1).offsetWidth / 2 - padding)}px`
        // The row's flat plane is in front of the turned links: it lets the
        // pointer through to them.
        row.style.pointerEvents = 'none'
        for (const column of columns) column.style.pointerEvents = 'auto'
        build()
        stale = false
      }
      const viewRect = view.getBoundingClientRect()
      // No scrolling past the first or the last column in the middle (the
      // turned slices make the strip scroll further than its own width).
      const columns = [...row.children].filter((column) => column !== layer)
      const middle = viewRect.left + viewRect.width / 2
      const firstMiddle = row.getBoundingClientRect().left + columns[0].offsetLeft + columns[0].offsetWidth / 2
      const lastMiddle = row.getBoundingClientRect().left + columns.at(-1).offsetLeft + columns.at(-1).offsetWidth / 2
      const past = Math.min(0, lastMiddle - middle) || Math.max(0, firstMiddle - middle)
      if (Math.abs(past) >= 1) {
        view.scrollLeft += past
      }
      const rowLeft = row.getBoundingClientRect().left
      const center = viewRect.left + viewRect.width / 2 - rowLeft
      const radius = viewRect.width / 2
      row.style.perspective = `${CYLINDER_PERSPECTIVE}px`
      row.style.perspectiveOrigin = `${center}px 50%`
      for (const { slice, x } of slices) {
        const { theta, transform } = place(x, center, radius)
        // Past the cylinder's sides: out of sight.
        const hidden = Math.abs(theta) > Math.PI / 2
        slice.style.visibility = hidden ? 'hidden' : ''
        if (!hidden) slice.style.transform = transform
      }
      // The links (and the other tiles), turned as their column's middle.
      for (const column of row.children) {
        if (column === layer) continue
        const { x } = rowOffset(column)
        const { theta, transform } = place(x + column.offsetWidth / 2, center, radius)
        column.style.visibility = Math.abs(theta) > Math.PI / 2 ? 'hidden' : ''
        column.style.transform = transform
      }
    }
    function schedule() {
      frame ??= requestAnimationFrame(layout)
    }
    function rebuild() {
      stale = true
      schedule()
    }

    function onScroll() {
      schedule()
    }

    layout()
    view.style.scrollSnapType = 'x mandatory'
    view.addEventListener('scroll', onScroll, { passive: true })
    // A thumbnail loaded (they're lazy): its slices can be made.
    row.addEventListener('load', rebuild, true)
    const observer = new ResizeObserver(rebuild)
    observer.observe(view)
    observer.observe(row)
    return () => {
      cancelAnimationFrame(frame)
      view.style.scrollSnapType = ''
      view.removeEventListener('scroll', onScroll)
      row.removeEventListener('load', rebuild, true)
      observer.disconnect()
      layer.replaceChildren()
      for (const img of images) img.style.opacity = ''
      for (const tile of tiles) tile.style.opacity = ''
      for (const column of row.children) {
        column.style.transform = ''
        column.style.visibility = ''
        column.style.pointerEvents = ''
      }
      Object.assign(row.style, { marginLeft: '', marginRight: '', pointerEvents: '' })
    }
  }, [assetsList])

  useEffect(() => {
    const list = []

    if (mediaList && !mediaList.empty) {
      const docs = [...mediaList.docs].sort((a, b) => {
        const aCover = a.data().isCover ? 1 : 0
        const bCover = b.data().isCover ? 1 : 0

        if (aCover !== bCover) {
          return bCover - aCover
        }

        const aDate = a.data().date?.toDate?.() ?? 0
        const bDate = b.data().date?.toDate?.() ?? 0
        return bDate - aDate
      })

      const assetsListLength = Math.min(docs.length, assetsListMaxLength)
      const assetItems = []
      let i

      for (i = 0; i < assetsListLength; i++) {
        assetItems.push({
          isMedia: true,
          item: docs[i].data(),
        })
      }

      if (mediaList.size > assetsListMaxLength) {
        assetItems.push({
          isMedia: false,
          // The first photo not shown, where its gallery opens.
          firstHiddenId: docs[assetsListLength].id,
        })
      }

      const lastColIdx = getColPosition(assetItems.length - 1)

      function isLastCol(i) {
        return getColPosition(i) === lastColIdx
      }

      for (i = 0; i < assetItems.length; i += 3) {
        list.push(
          <MediaListCol key={i} isLast={isLastCol(i)}>
            <Media asset={assetItems[i]} index={i} caveId={caveId} editable={editable} photoPath={photoPath} canDelete={canDelete} onDelete={setPictureToDelete} />
          </MediaListCol>,
        )

        if (assetItems[i + 1]) {
          const colItems = [
            <MediaListCell key={1} height={assetsListHeight / 2} width={assetsListHeight / 2}>
              <Media asset={assetItems[i + 1]} index={i + 1} size="half" caveId={caveId} editable={editable} photoPath={photoPath} canDelete={canDelete} onDelete={setPictureToDelete} />
            </MediaListCell>,
          ]

          if (assetItems[i + 2]) {
            colItems.push(
              <MediaListCell key={2} position="bottom" height={assetsListHeight / 2} width={assetsListHeight / 2}>
                <Media asset={assetItems[i + 2]} index={i + 2} size="half" caveId={caveId} editable={editable} photoPath={photoPath} canDelete={canDelete} onDelete={setPictureToDelete} />
              </MediaListCell>,
            )
          }

          list.push(
            <MediaListCol key={i + 1} isLast={isLastCol(i + 1)} width="half">
              {colItems}
            </MediaListCol>,
          )
        }
      }
      setAssetsList(list)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaList, editable, canDelete, caveId, photoPath])

  return (
    <>
      {mediaList && !mediaList.empty && (
        <Box
          className={`oc-media-list ${className || ''}`.trim()}
          sx={{
            marginBottom: 'calc(var(--oc-pane-padding-block) * -1)',
            height: `calc((var(--oc-pane-padding-block) * 1) + ${assetsListHeight + zoomRoom * 2}px)`,
            ...sx,
          }}
          {...props}
        >
          <Scrollbars
            ref={scrollbarsRef}
            autoHide
            autoHeight
            autoHeightMax={assetsListHeight + zoomRoom * 2 + 100}
            trackHorizontalProps={{
              style: {
                left: 'calc(var(--oc-pane-padding-inline) / 2)',
                right: 'calc(var(--oc-pane-padding-inline) / 2)',
                bottom: `calc((var(--oc-pane-padding-block) - ${SCROLLBAR_TRACK_HEIGHT}px) / 2)`,
              },
            }}
          >
            <Box sx={{ px: 'var(--oc-pane-padding-inline)', pr: 'var(--oc-pane-padding-inline)', py: `${zoomRoom}px`, mb: 'var(--oc-pane-padding-block)', width: 'fit-content' }}>
              <Grid ref={rowRef} container direction="row" sx={{ position: 'relative', width: 'min-content', display: 'flex', flexWrap: 'nowrap', transformStyle: 'preserve-3d' }}>
                {assetsList}
                {/* The photos' slices on the cylinder (filled by its effect). */}
                <Box ref={sliceLayerRef} className="oc-media-list--cylinder" aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', transformStyle: 'preserve-3d' }} />
              </Grid>
            </Box>
          </Scrollbars>
        </Box>
      )}
      <Dialog className="oc-media-list--delete-dialog" open={Boolean(pictureToDelete)} onClose={closeDeleteDialog}>
        <DialogTitle sx={{ pr: 7 }}>{t('deletePicture')}</DialogTitle>
        <DialogCloseButton onClick={closeDeleteDialog} disabled={deleting} />
        <DialogContent>
          <DialogContentText>{t('deletePictureConfirm')}</DialogContentText>
          {deleteError && <Alert severity="error">{t('deletePictureError')}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} disabled={deleting}>
            {t('cancel')}
          </Button>
          <Button color="error" onClick={handleDelete} disabled={deleting}>
            {t('delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function Media({ asset, index, size = 'full', caveId, editable, photoPath, canDelete, onDelete }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const fullHeight = ASSETS_LIST_CONFIG.height
  const fullWidth = ASSETS_LIST_CONFIG.height * ASSETS_LIST_CONFIG.widthRatio
  const width = size === 'full' ? fullWidth : fullWidth / 2 - ASSETS_LIST_CONFIG.spacing / 2
  const height = size === 'full' ? fullHeight : fullHeight / 2 - ASSETS_LIST_CONFIG.spacing / 2

  if (!asset.isMedia) {
    return <MoreMedias width={width} height={height} to={photoPath ? photoPath(asset.firstHiddenId) : editable ? `/map/${caveId}/medias` : 'medias'} state={photoPath ? { fromPage: true } : undefined} />
  }

  const media = asset.item

  // The thumbnail <Picture> shows, preloaded in CORS mode like <Picture>
  // itself, so both share one request.
  const assetUrl = media.getThumbnailUrl('resultThumbnail')
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { src, status, error } = useImage(assetUrl, 'anonymous')

  return status === 'loading' ? (
    <Skeleton variant="rounded" width={width} height={height} sx={{ borderRadius: '.5rem' }} />
  ) : status === 'success' ? (
    <Box className="oc-media-list--picture" sx={{ position: 'relative', width, height, borderRadius: '.5rem', overflow: 'hidden' }}>
      <ButtonBase component={Link} to={photoPath ? photoPath(media.id) : editable ? `/map/${caveId}/medias/${media.id}` : `medias/${media.id}`} state={photoPath ? { fromPage: true } : undefined} aria-label={t('openPhoto', { n: (index ?? 0) + 1 })}>
        <Picture sources={media.getSources('resultThumbnail')} alt="" loading="lazy" style={{ width, height, objectFit: 'cover' }} />
      </ButtonBase>
      {/* Editing (admins): an X deletes it, after a confirmation. */}
      {editable && canDelete && (
        <Tooltip title={t('deletePicture')}>
          <IconButton
            className="oc-media-list--delete"
            size="small"
            aria-label={t('deletePicture')}
            onClick={(event) => {
              // Focus off the button first: the dialog hides the page (aria-hidden on
              // #root) before taking focus, which the browser blocks.
              event.currentTarget.blur()
              onDelete(media)
            }}
            sx={{ position: 'absolute', top: 6, right: 6, color: 'common.white', bgcolor: 'rgb(0 0 0 / 0.5)', '&:hover': { bgcolor: 'rgb(0 0 0 / 0.65)' } }}
          >
            <CloseRounded fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  ) : status === 'failed' ? (
    <Box
      sx={{
        width,
        height,
        borderRadius: '.5rem',
        backgroundColor: 'rgb(0 0 0 / 4.5%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'smaller',
        padding: 1,
      }}
    >
      {error}
    </Box>
  ) : null
}

function MediaListCol({ children, width = 'full', isLast = false, height = ASSETS_LIST_CONFIG.height, ...props }) {
  const defaultWidth = ASSETS_LIST_CONFIG.height * ASSETS_LIST_CONFIG.widthRatio
  const widths = {
    full: isLast ? defaultWidth : defaultWidth + ASSETS_LIST_CONFIG.spacing,
    half: isLast ? defaultWidth / 2 : (defaultWidth + ASSETS_LIST_CONFIG.spacing) / 2,
  }

  return (
    <Grid {...props} container direction="column" sx={{ minHeight: height, minWidth: widths[width], position: 'relative', flexWrap: 'nowrap', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
      {children}
    </Grid>
  )
}

function MediaListCell({ children, width = 'full', height = ASSETS_LIST_CONFIG.height, position = 'top', ...props }) {
  const widths = {
    full: ASSETS_LIST_CONFIG.height,
    half: ASSETS_LIST_CONFIG.height / 2,
  }

  return (
    <Grid {...props} container direction="column" sx={{ minHeight: height, minWidth: widths[width], position: 'relative', flexWrap: 'nowrap', justifyContent: width === 'full' ? 'center' : position === 'top' ? 'flex-start' : 'flex-end', alignItems: 'flex-start' }}>
      {children}
    </Grid>
  )
}

function MoreMedias({ width, height, to, state }) {
  const { t } = useTranslation('resultPane')

  return (
    <ButtonBase
      component={Link}
      to={to}
      state={state}
      className="oc-media-list--more"
      sx={{
        borderRadius: '.5rem',
        backgroundColor: (theme) => `rgb(${theme.vars.palette.primary.mainChannel} / 0.1)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 1,
        width,
        height,
        opacity: 0.85,
        ':hover': {
          opacity: 1,
        },
      }}
    >
      <Grid container direction="column" sx={{ alignItems: 'center', rowGap: 0.75 }}>
        <PhotoLibraryRounded fontSize="small" sx={primaryToneSx} />
        <Typography
          sx={(theme) => ({
            fontSize: '.875rem',
            ...primaryToneSx(theme),
          })}
        >
          {t('morePicturesBtn')}
        </Typography>
      </Grid>
    </ButtonBase>
  )
}
