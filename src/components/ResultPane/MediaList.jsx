import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Alert, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Skeleton, Typography } from '@mui/material'
import CloseRounded from '@mui/icons-material/CloseRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import EditRounded from '@mui/icons-material/EditRounded'
import PhotoLibraryRounded from '@mui/icons-material/PhotoLibraryRounded'
import { Grid } from '@mui/material'
import Scrollbars from '@/components/Scrollbars/Scrollbars.jsx'
import CardOptionsMenu from './CardOptionsMenu.jsx'
import Picture from '@/components/Picture.jsx'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'
import { deleteById, useCaveAssetsList } from '@/models/CaveAsset.js'
import { useImage } from '@/hooks/useImage.jsx'
import { ASSETS_LIST_CONFIG } from '@/config/resultPane.js'
import { SCROLLBAR_STEP_FACTOR, SCROLLBAR_TRACK_HEIGHT } from '@/config/app.js'

function getProp(which, theme) {
  if (which === 'color') {
    return theme.palette.mode === 'light' ? theme.palette.primary.dark : theme.palette.primary.light
  }
}

export default function MediaList({ caveId, editable = false, sx, className, ...props }) {
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
        })
      }

      const lastColIdx = getColPosition(assetItems.length - 1)

      function isLastCol(i) {
        return getColPosition(i) === lastColIdx
      }

      for (i = 0; i < assetItems.length; i += 3) {
        list.push(
          <MediaListCol key={i} isLast={isLastCol(i)}>
            <Media asset={assetItems[i]} caveId={caveId} editable={editable} canDelete={canDelete} onDelete={setPictureToDelete} />
          </MediaListCol>,
        )

        if (assetItems[i + 1]) {
          const colItems = [
            <MediaListCell key={1} height={assetsListHeight / 2} width={assetsListHeight / 2}>
              <Media asset={assetItems[i + 1]} size="half" caveId={caveId} editable={editable} canDelete={canDelete} onDelete={setPictureToDelete} />
            </MediaListCell>,
          ]

          if (assetItems[i + 2]) {
            colItems.push(
              <MediaListCell key={2} position="bottom" height={assetsListHeight / 2} width={assetsListHeight / 2}>
                <Media asset={assetItems[i + 2]} size="half" caveId={caveId} editable={editable} canDelete={canDelete} onDelete={setPictureToDelete} />
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
  }, [mediaList, editable, canDelete, caveId])

  return (
    <>
      {mediaList && !mediaList.empty && (
        <Box
          className={`oc-media-list ${className || ''}`.trim()}
          sx={{
            marginBottom: 'calc(var(--oc-pane-padding-block) * -1)',
            height: `calc((var(--oc-pane-padding-block) * 1) + ${assetsListHeight}px)`,
            ...sx,
          }}
          {...props}
        >
          <Scrollbars
            ref={scrollbarsRef}
            autoHide
            autoHeight
            autoHeightMax={assetsListHeight + 100}
            trackHorizontalProps={{
              style: {
                left: 'calc(var(--oc-pane-padding-inline) / 2)',
                right: 'calc(var(--oc-pane-padding-inline) / 2)',
                bottom: `calc((var(--oc-pane-padding-block) - ${SCROLLBAR_TRACK_HEIGHT}px) / 2)`,
              },
            }}
          >
            <Box sx={{ px: 'var(--oc-pane-padding-inline)', pr: 'var(--oc-pane-padding-inline)', mb: 'var(--oc-pane-padding-block)', width: 'fit-content' }}>
              <Grid container direction="row" sx={{ width: 'min-content', display: 'flex', flexWrap: 'nowrap' }}>
                {assetsList}
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

function Media({ asset, size = 'full', caveId, editable, canDelete, onDelete }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const [viewerOpen, setViewerOpen] = useState(false)
  const fullHeight = ASSETS_LIST_CONFIG.height
  const fullWidth = ASSETS_LIST_CONFIG.height * ASSETS_LIST_CONFIG.widthRatio
  const width = size === 'full' ? fullWidth : fullWidth / 2 - ASSETS_LIST_CONFIG.spacing / 2
  const height = size === 'full' ? fullHeight : fullHeight / 2 - ASSETS_LIST_CONFIG.spacing / 2

  if (!asset.isMedia) {
    return <MoreMedias width={width} height={height} to={editable ? `/map/${caveId}/medias` : 'medias'} />
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
    <Box sx={{ position: 'relative', width, height, borderRadius: '.5rem', overflow: 'hidden' }}>
      <ButtonBase component={Link} to={editable ? `/map/${caveId}/medias/${media.id}` : `medias/${media.id}`}>
        <Picture sources={media.getSources('resultThumbnail')} alt="" loading="lazy" style={{ width, height, objectFit: 'cover' }} />
      </ButtonBase>
      {editable && (
        <CardOptionsMenu
          ariaLabel={t('pictureOptions')}
          actions={[
            { label: t('editPicture'), icon: <EditRounded fontSize="small" />, onClick: () => setViewerOpen(true) },
            ...(canDelete ? [{ label: t('deletePicture'), icon: <DeleteOutlineRounded fontSize="small" />, onClick: () => onDelete(media), danger: true }] : []),
          ]}
        />
      )}
      <Dialog className="oc-picture-viewer-dialog" open={viewerOpen} onClose={() => setViewerOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
          <IconButton onClick={() => setViewerOpen(false)} aria-label={t('closePicture')}>
            <CloseRounded />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: 'common.black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Picture sources={media.getSources(['1024', '1536', '4k'], { sizes: true })} alt="" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
        </DialogContent>
      </Dialog>
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

function MoreMedias({ width, height, to }) {
  const { t } = useTranslation('resultPane')

  return (
    <ButtonBase
      component={Link}
      to={to}
      sx={{
        borderRadius: '.5rem',
        backgroundColor: (theme) => `rgb(${theme.palette.primary.mainChannel} / ${theme.palette.mode === 'light' ? 0.1 : 0.08})`,
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
        <PhotoLibraryRounded fontSize="small" sx={{ color: (theme) => getProp('color', theme) }} />
        <Typography
          sx={{
            fontSize: '.875rem',
            color: (theme) => getProp('color', theme),
          }}
        >
          {t('morePicturesBtn')}
        </Typography>
      </Grid>
    </ButtonBase>
  )
}
