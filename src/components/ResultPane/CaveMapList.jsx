import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import DeleteForeverRounded from '@mui/icons-material/DeleteForeverRounded'
import EditRounded from '@mui/icons-material/EditRounded'
import MapOutlined from '@mui/icons-material/MapOutlined'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'
import AddButton from '@/components/AddButton.jsx'
import PartialDateField from '@/components/PartialDateField.jsx'
import { Box, Button, ButtonBase, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import Scrollbars from '@/components/Scrollbars/Scrollbars.jsx'
import mapsModel from '@/models/MapModel.js'
import { isTrashed } from '@/utils/trash.js'
import DraggableDialogPaper from '@/components/DraggableDialogPaper.jsx'
import AuthorsField from '@/components/MapsPicker/AuthorsField.jsx'
import MapSistemaField from '@/components/MapsPicker/MapSistemaField.jsx'
import PendingFilePreview from '@/components/MapsPicker/PendingFilePreview.jsx'
import CardOptionsMenu from './CardOptionsMenu.jsx'
import SistemaModel from '@/models/SistemaModel.js'
import ConnectionModel from '@/models/ConnectionModel.js'
import { getSistemaMapRefs } from '@/utils/sistemaMaps.js'
import MapUploadFeedback, { useMapUpload } from '@/components/MapsPicker/MapUpload.jsx'
import { useCanTrashMaps, useTrashMapConfirm } from '@/components/MapPane/TrashMap.jsx'
import { SCROLLBAR_STEP_FACTOR, SCROLLBAR_TRACK_HEIGHT } from '@/config/app.js'
import { ASSETS_LIST_CONFIG } from '@/config/resultPane.js'

const emptyPendingDetails = { title: '', date: '', authors: [], note: '' }

// The title bar over a map's thumbnail: a caption line and its padding. The
// options menu sits on it, as tall as it and centred.
const TITLE_BAR_PY = 0.5
const TITLE_BAR_HEIGHT = 'calc(0.75rem * 1.66 + 8px)'
const TITLE_BAR_MENU_SX = { top: 0, right: 4, height: TITLE_BAR_HEIGHT, width: TITLE_BAR_HEIGHT, p: 0 }

function MapPreview({ caveId, map, index, returnTo, menu = false }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const [failed, setFailed] = useState(false)
  const { file } = map
  // thumbnailUrl/previewUrl: WebP (or SVG) derivatives made by the
  // onMap*Uploaded functions, much lighter than the original upload.
  const url = file?.thumbnailUrl || file?.previewUrl || map.url
  const image = (file?.thumbnailUrl || file?.previewUrl || file?.contentType?.startsWith('image/')) && !failed
  const content = (
    <>
      {image ? <Box component="img" src={url} alt="" loading="lazy" crossOrigin="anonymous" onError={() => setFailed(true)} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Box sx={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', bgcolor: 'action.hover' }}>{file?.contentType === 'application/pdf' ? <PictureAsPdfRounded color="primary" fontSize="large" /> : <MapOutlined color="primary" fontSize="large" />}</Box>}
      <Typography
        variant="caption"
        noWrap
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          px: 1,
          py: TITLE_BAR_PY,
          // Room at the right for the options menu, when it's there.
          pr: menu ? 5 : 1,
          color: 'common.white',
          bgcolor: 'rgba(0, 0, 0, 0.6)',
          // Over the thumbnail's outline: along the title, the edge is its colour.
          zIndex: 1,
        }}
      >
        {file?.name || t('openMap')}
      </Typography>
    </>
  )

  return (
    <ButtonBase component={Link} to={`/map/${caveId}/maps/${map.value}`} state={{ from: returnTo }} aria-label={t('openMapNumber', { index })} sx={{ position: 'relative', display: 'block', width: '100%', height: '100%' }}>
      {content}
    </ButtonBase>
  )
}

// Maps belong to a sistema (shared by every cave in it), not to an individual
// cave - this tab is a view onto `sistemaId`'s sistema.maps plus its ancestor
// sistemas' maps, read and written directly (not staged in the cave's own
// edit form) since it isn't this cave's own data. New maps are added to the
// cave's own sistema; inherited ones can only be removed from their own
// sistema, since removing them here would affect every sibling cave.
export default function CaveMapList({ caveId, sistemaId, canAdd = true, onAddUnauthorized, returnTo }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const { t: tMaps } = useTranslation('mapsPicker')
  const [sistemas] = SistemaModel.useAll()
  const sistema = sistemas.find((s) => s.id === sistemaId)
  const [connections] = ConnectionModel.useAll()
  // With the maps in the trash, to leave out the sistema's references to them
  // (kept, so a restored map comes back), not show them as unknown files.
  const [mapFiles] = mapsModel.useAll({ includeTrashed: true })
  const scrollbarsRef = useRef()
  const fileInputRef = useRef()
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingDetails, setPendingDetails] = useState(emptyPendingDetails)
  const navigate = useNavigate()
  const { uploadMap, uploading, progress, current, error, clearError } = useMapUpload()
  // Admins: deleting the map itself (to the trash), not only from this sistema.
  const canTrash = useCanTrashMaps()
  const { requestTrash, dialog: trashDialog } = useTrashMapConfirm()
  const mapValues = (Array.isArray(sistema?.maps) ? sistema.maps : []).map((value) => value.trim()).filter(Boolean)
  const selectedMaps = getSistemaMapRefs(sistemaId, sistemas, connections)
    .map(({ id: value, sistemaId: ownerId }) => {
      const file = mapFiles.find((map) => map.id === value)
      return { value, file, url: file?.url || value, inherited: ownerId !== sistemaId }
    })
    .filter((map) => !isTrashed(map.file))
  const mapWidth = ASSETS_LIST_CONFIG.height * ASSETS_LIST_CONFIG.widthRatio
  const mapHeight = ASSETS_LIST_CONFIG.height

  useEffect(() => {
    const scrollbar = scrollbarsRef.current
    const container = scrollbar?.container
    if (!container) return undefined

    function onWheel(event) {
      event.preventDefault()
      const { scrollLeft, scrollWidth, clientWidth } = scrollbar.getValues()
      const maxScrollLeft = scrollWidth - clientWidth
      const direction = Math.sign(event.deltaY || event.deltaX)
      if (!direction || maxScrollLeft <= 0) return
      scrollbar.scrollLeft(Math.max(0, Math.min(maxScrollLeft, scrollLeft + SCROLLBAR_STEP_FACTOR * direction)))
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [selectedMaps.length])

  async function saveMaps(nextMaps) {
    await SistemaModel.save(sistemaId, { maps: nextMaps })
  }

  function selectFile() {
    clearError()
    fileInputRef.current?.click()
  }

  function handleFileSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPendingFile(file)
    setPendingDetails({ ...emptyPendingDetails, title: sistema?.name || '' })
  }

  function cancelPendingUpload() {
    setPendingFile(null)
    setPendingDetails(emptyPendingDetails)
  }

  async function confirmUpload() {
    const trimmedAuthors = pendingDetails.authors.map((author) => author.trim()).filter(Boolean)
    const uploaded = await uploadMap(pendingFile, {
      title: pendingDetails.title.trim(),
      date: pendingDetails.date || undefined,
      authors: trimmedAuthors,
      note: pendingDetails.note.trim() || undefined,
    })
    if (!uploaded) return

    await saveMaps([...mapValues, uploaded.id])
    setPendingFile(null)
    setPendingDetails(emptyPendingDetails)
  }

  return (
    <>
      {selectedMaps.length > 0 && (
        <Box sx={{ height: `calc(var(--oc-pane-padding-block) + ${mapHeight}px)`, mb: 'calc(var(--oc-pane-padding-block) * -1)' }}>
          <Scrollbars ref={scrollbarsRef} autoHide autoHeight autoHeightMax={mapHeight + 100} trackHorizontalProps={{ style: { left: 'calc(var(--oc-pane-padding-inline) / 2)', right: 'calc(var(--oc-pane-padding-inline) / 2)', bottom: `calc((var(--oc-pane-padding-block) - ${SCROLLBAR_TRACK_HEIGHT}px) / 2)` } }}>
            <Box sx={{ display: 'flex', gap: `${ASSETS_LIST_CONFIG.spacing}px`, px: 'var(--oc-pane-padding-inline)', mb: 'var(--oc-pane-padding-block)', width: 'fit-content' }}>
              {selectedMaps.map((map, index) => (
                <Box key={`${map.value}-${index}`} className="oc-cave-map-list--item"
                  sx={(theme) => ({
                    position: 'relative', width: mapWidth, height: mapHeight, flex: '0 0 auto', borderRadius: '.5rem', overflow: 'hidden',
                    // A thin outline over the picture's edge (not around it: the size stays).
                    '&::after': { content: '""', position: 'absolute', inset: 0, borderRadius: 'inherit', border: `1px solid ${theme.vars.sys.color.outlineVariant}`, pointerEvents: 'none' },
                  })}>
                  <MapPreview caveId={caveId} map={map} index={index + 1} returnTo={returnTo} menu={canAdd && !uploading} />
                  {map.file?.contentType === 'application/pdf' && (
                    <Button component="a" href={map.file.url} target="_blank" rel="noopener noreferrer" size="small" sx={{ position: 'absolute', bottom: 4, left: 4, bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' } }}>
                      {t('originalFile')}
                    </Button>
                  )}
                  {canAdd && !uploading && <CardOptionsMenu ariaLabel={t('mapOptions')} sx={TITLE_BAR_MENU_SX} actions={[{ label: t('editMap'), icon: <EditRounded fontSize="small" />, onClick: () => navigate(`/map/${caveId}/maps/${map.value}/edit`, { state: { from: returnTo } }) }, canTrash && map.file && { label: t('trashMap'), icon: <DeleteForeverRounded fontSize="small" />, onClick: () => requestTrash(map.file), danger: true }].filter(Boolean)} />}
                </Box>
              ))}
            </Box>
          </Scrollbars>
        </Box>
      )}
      {(canAdd || onAddUnauthorized) && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: selectedMaps.length > 0 ? 2 : 0 }}>
            <AddButton startIcon={uploading ? <CircularProgress size={18} /> : undefined} disabled={uploading || (canAdd && !sistemaId)} onClick={() => (canAdd ? selectFile() : onAddUnauthorized?.())}>
              {t('addMap')}
            </AddButton>
          </Box>
          {canAdd && !sistemaId && (
            // Supporting text for the Add map button above: 8dp from it, and a
            // little extra room (with the form's own gap, 24dp) after it.
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1, mb: 1 }}>
              {t('mapsNeedSistema')}
            </Typography>
          )}
          <input ref={fileInputRef} type="file" hidden accept="image/*,application/pdf" onChange={handleFileSelected} />
          <MapUploadFeedback uploading={uploading} progress={progress} current={current} error={error} clearError={clearError} />
        </>
      )}

      {trashDialog}

      <Dialog className="oc-cave-map-list--upload-dialog" open={!!pendingFile} onClose={cancelPendingUpload} maxWidth={false} PaperComponent={DraggableDialogPaper}>
        <DialogTitle noWrap className="oc-draggable-dialog--handle" sx={{ cursor: 'move' }}>
          {pendingFile?.name}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: 900 }}>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Box sx={{ width: 440, height: 440, flexShrink: 0 }}>
              <PendingFilePreview file={pendingFile} width={440} height={440} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
              <MapSistemaField autoFocus value={pendingDetails.title} onChange={(title) => setPendingDetails((d) => ({ ...d, title }))} />
              <PartialDateField size="small" label={tMaps('mapDate')} description={tMaps('mapDateHint')} fullWidth value={pendingDetails.date} onChange={(e) => setPendingDetails((d) => ({ ...d, date: e.target.value }))} />
              <AuthorsField value={pendingDetails.authors} onChange={(authors) => setPendingDetails((d) => ({ ...d, authors }))} />
              <TextField size="small" label={tMaps('mapNote')} fullWidth multiline minRows={2} value={pendingDetails.note} onChange={(e) => setPendingDetails((d) => ({ ...d, note: e.target.value }))} sx={{ '& textarea': { resize: 'vertical' } }} />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelPendingUpload} disabled={uploading}>
            {tMaps('cancel')}
          </Button>
          <Button variant="contained" onClick={confirmUpload} disabled={uploading || !pendingDetails.title.trim()} startIcon={uploading ? <CircularProgress size={16} /> : undefined}>
            {tMaps('add')}
          </Button>
        </DialogActions>
      </Dialog>

    </>
  )
}
