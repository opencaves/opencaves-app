import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Alert, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Skeleton, Tooltip, Typography } from '@mui/material'
import CloseRounded from '@mui/icons-material/CloseRounded'
import PhotoLibraryRounded from '@mui/icons-material/PhotoLibraryRounded'
import { Grid } from '@mui/material'
import MediaStrip from './MediaStrip.jsx'
import Picture from '@/components/Picture.jsx'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'
import { deleteById, useCaveAssetsList } from '@/models/CaveAsset.js'
import { useImage } from '@/hooks/useImage.jsx'
import { ASSETS_LIST_CONFIG } from '@/config/resultPane.js'

// The primary's darker tone, its lighter one in dark mode.
const primaryToneSx = (theme) => ({ color: theme.vars.palette.primary.dark, ...theme.applyStyles('dark', { color: theme.vars.palette.primary.light }) })

/**
 * A cave's photo strip: its photos and videos in columns (a wide one, then
 * two stacked), a "more photos" tile at its end, on a
 * {@link MediaStrip} (its cylinder, its scrolling).
 *
 * @param {object} props - Also its root's (a Box's).
 * @param {string} props.caveId
 * @param {boolean} [props.editable=false]
 * @param {(id: string) => string} [props.photoPath] - A photo's address (a page's gallery); the map's viewer otherwise.
 * @param {Sx} [props.sx]
 * @param {string} [props.className]
 */
export default function MediaList({ caveId, editable = false, photoPath, sx, className, ...props }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  // Deleting a photo: admins only (as in firestore.rules).
  const canDelete = useSelector((/** @type {RootState} */ state) => state.session.roles.includes('admin'))
  const [mediaList, loading, error] = useCaveAssetsList(caveId)
  const [assetsList, setAssetsList] = useState(null)
  const [pictureToDelete, setPictureToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const { height: assetsListHeight, maxLength: assetsListMaxLength } = ASSETS_LIST_CONFIG

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
    const list = []

    if (mediaList && !mediaList.empty) {
      // In the order every view shows them (CaveAsset.js's photoOrder).
      const { docs } = mediaList

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
        <MediaStrip start="start" className={`oc-media-list ${className || ''}`.trim()} itemHeight={assetsListHeight} rebuildKey={assetsList} sx={sx} {...props}>
          {assetsList}
        </MediaStrip>
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
    <Box className="oc-media-list--picture oc-media-strip--picture oc-media-strip--item" sx={{ position: 'relative', width, height, borderRadius: '.5rem', overflow: 'hidden' }}>
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
            <CloseRounded />
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
    <Grid {...props} container sx={{ flexDirection: 'column', minHeight: height, minWidth: widths[width], position: 'relative', flexWrap: 'nowrap', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
      {children}
    </Grid>
  )
}

/**
 * A cell of a photo column: a full-height photo or a half one.
 *
 * @param {import('@mui/material/Grid').GridProps & { width?: 'full' | 'half' | number, height?: number, position?: 'top' | 'bottom' }} props - A
 *   Grid's; `width` 'full' or 'half' (a number matches neither: no minimum
 *   width), `position` the half photo's.
 */
function MediaListCell({ children, width = 'full', height = ASSETS_LIST_CONFIG.height, position = 'top', ...props }) {
  const widths = {
    full: ASSETS_LIST_CONFIG.height,
    half: ASSETS_LIST_CONFIG.height / 2,
  }

  return (
    <Grid {...props} container sx={{ flexDirection: 'column', minHeight: height, minWidth: widths[width], position: 'relative', flexWrap: 'nowrap', justifyContent: width === 'full' ? 'center' : position === 'top' ? 'flex-start' : 'flex-end', alignItems: 'flex-start' }}>
      {children}
    </Grid>
  )
}

// A tile at the strip's end ("more photos"): an icon over a
// label, on a light tint of the primary colour.
function StripTile({ icon, label, className, sx, ...props }) {
  return (
    <ButtonBase
      {...props}
      className={['oc-media-list--tile', 'oc-media-strip--tile', 'oc-media-strip--see-through', 'oc-media-strip--item', className].filter(Boolean).join(' ')}
      sx={[
        {
          borderRadius: '.5rem',
          backgroundColor: (theme) => `rgb(${theme.vars.palette.primary.mainChannel} / 0.1)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 1,
          opacity: 0.85,
          ':hover': {
            opacity: 1,
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Grid container sx={{ flexDirection: 'column', alignItems: 'center', rowGap: 0.75 }}>
        {icon}
        <Typography
          sx={(theme) => ({
            fontSize: '.875rem',
            textAlign: 'center',
            ...primaryToneSx(theme),
          })}
        >
          {label}
        </Typography>
      </Grid>
    </ButtonBase>
  )
}

function MoreMedias({ width, height, to, state }) {
  const { t } = useTranslation('resultPane')

  return <StripTile component={Link} to={to} state={state} className="oc-media-list--more" sx={{ width, height }} icon={<PhotoLibraryRounded fontSize="small" sx={primaryToneSx} />} label={t('morePicturesBtn')} />
}

