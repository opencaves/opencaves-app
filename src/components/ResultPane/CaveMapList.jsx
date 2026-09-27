import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AddRounded, DeleteOutlineRounded, EditRounded, MapOutlined, PictureAsPdfRounded } from '@mui/icons-material'
import { Box, Button, ButtonBase, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material'
import Scrollbars from '@/components/Scrollbars/Scrollbars.jsx'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import MapUploadFeedback, { useMapUpload } from '@/components/MapsPicker/MapUpload.jsx'
import { scrollbarStepFactor, scrollbarTrackHeight } from '@/config/app.js'
import { assetsListConfig } from '@/config/resultPane.js'

const mapsModel = createCollectionModel('maps')

function isValidMapUrl(value) {
  try {
    const trimmed = value.trim()
    const url = new URL(trimmed, window.location.origin)
    return (trimmed.startsWith('/') || /^https?:\/\//i.test(trimmed)) && ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

function MapPreview({ map, index }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const [failed, setFailed] = useState(false)
  const { file } = map
  const url = file?.previewUrl || map.url
  const valid = isValidMapUrl(url)
  const image = valid && (file?.previewUrl || file?.contentType?.startsWith('image/') || /\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/i.test(url)) && !failed
  const content = image ? (
    <Box component="img" src={url} alt="" loading="lazy" onError={() => setFailed(true)} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  ) : (
    <Box sx={{ display: 'grid', placeItems: 'center', alignContent: 'center', gap: 1, width: '100%', height: '100%', bgcolor: 'action.hover' }}>
      {file?.contentType === 'application/pdf' ? <PictureAsPdfRounded color="primary" fontSize="large" /> : <MapOutlined color="primary" fontSize="large" />}
      <Typography variant="body2" noWrap sx={{ maxWidth: '100%', px: 2 }}>
        {file?.name || t('openMap')}
      </Typography>
    </Box>
  )

  return valid ? (
    <ButtonBase component="a" href={url} target="_blank" rel="noopener noreferrer" aria-label={t('openMapNumber', { index })} sx={{ display: 'block', width: '100%', height: '100%' }}>
      {content}
    </ButtonBase>
  ) : (
    content
  )
}

export default function CaveMapList({ maps, onChange, onAdd, canAdd = true, onAddUnauthorized }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const editable = Boolean(onChange)
  const addMap = onChange || onAdd
  const [mapFiles] = mapsModel.useAll()
  const scrollbarsRef = useRef()
  const fileInputRef = useRef()
  const [editingIndex, setEditingIndex] = useState(null)
  const { uploadMaps, uploading, progress, current, total, error, success, clearError } = useMapUpload()
  const [uploadedMaps, setUploadedMaps] = useState({})
  const mapValues = (Array.isArray(maps) ? maps : typeof maps === 'string' ? maps.split('|') : []).map((value) => value.trim()).filter(Boolean)
  const selectedMaps = mapValues.map((value) => {
    const savedMap = mapFiles.find((map) => map.id === value)
    const file = savedMap ? { ...uploadedMaps[value], ...savedMap } : uploadedMaps[value]
    return { value, file, url: file?.url || value }
  })
  const mapWidth = assetsListConfig.height * assetsListConfig.widthRatio
  const mapHeight = assetsListConfig.height

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
      scrollbar.scrollLeft(Math.max(0, Math.min(maxScrollLeft, scrollLeft + scrollbarStepFactor * direction)))
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [mapValues.length])

  function selectFile(index = null) {
    setEditingIndex(index)
    clearError()
    if (fileInputRef.current) {
      fileInputRef.current.multiple = index === null
      fileInputRef.current.click()
    }
  }

  async function handleFileSelected(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0) return
    const uploaded = await uploadMaps(files)
    if (uploaded.length === 0) return

    // A replacement must not modify a map file shared by another record.
    const nextMaps = [...mapValues]
    if (editingIndex === null) nextMaps.push(...uploaded.map((map) => map.id))
    else nextMaps[editingIndex] = uploaded[0].id
    setUploadedMaps((current) => Object.assign({}, current, ...uploaded.map((map) => ({ [map.id]: map }))))
    await addMap(nextMaps)
    setEditingIndex(null)
  }

  return (
    <>
      {selectedMaps.length > 0 && (
        <Box sx={{ height: `calc(var(--oc-pane-padding-block) + ${mapHeight}px)`, mb: 'calc(var(--oc-pane-padding-block) * -1)' }}>
          <Scrollbars ref={scrollbarsRef} autoHide autoHeight autoHeightMax={mapHeight + 100} trackHorizontalProps={{ style: { left: 'calc(var(--oc-pane-padding-inline) / 2)', right: 'calc(var(--oc-pane-padding-inline) / 2)', bottom: `calc((var(--oc-pane-padding-block) - ${scrollbarTrackHeight}px) / 2)` } }}>
            <Box sx={{ display: 'flex', gap: `${assetsListConfig.spacing}px`, px: 'var(--oc-pane-padding-inline)', mb: 'var(--oc-pane-padding-block)', width: 'fit-content' }}>
              {selectedMaps.map((map, index) => (
                <Box key={`${map.value}-${index}`} sx={{ position: 'relative', width: mapWidth, height: mapHeight, flex: '0 0 auto', borderRadius: '.5rem', overflow: 'hidden' }}>
                  <MapPreview map={map} index={index + 1} />
                  {map.file?.contentType === 'application/pdf' && (
                    <Button component="a" href={map.file.url} target="_blank" rel="noopener noreferrer" size="small" sx={{ position: 'absolute', bottom: 4, left: 4, bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' } }}>
                      {t('originalFile')}
                    </Button>
                  )}
                  {editable && (
                    <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.5, bgcolor: 'rgba(0, 0, 0, 0.75)', borderRadius: 1 }}>
                      <Tooltip title={t('editMap')}>
                        <IconButton size="small" aria-label={t('editMap')} disabled={uploading} onClick={() => selectFile(index)} sx={{ color: 'common.white' }}>
                          <EditRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('removeMap')}>
                        <IconButton size="small" aria-label={t('removeMap')} disabled={uploading} onClick={() => onChange(mapValues.filter((_, mapIndex) => mapIndex !== index))} sx={{ color: 'common.white' }}>
                          <DeleteOutlineRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          </Scrollbars>
        </Box>
      )}
      {addMap && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: mapValues.length > 0 ? 2 : 0 }}>
            <Button variant="outlined" size="small" startIcon={uploading ? <CircularProgress size={16} /> : <AddRounded />} disabled={uploading} onClick={() => (canAdd ? selectFile() : onAddUnauthorized?.())}>
              {t('addMap')}
            </Button>
          </Box>
          <input ref={fileInputRef} type="file" hidden accept="image/*,application/pdf" onChange={handleFileSelected} />
          <MapUploadFeedback uploading={uploading} progress={progress} current={current} total={total} error={error} success={success} clearError={clearError} />
        </>
      )}
    </>
  )
}
