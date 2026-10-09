import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import CloseRounded from '@mui/icons-material/CloseRounded'
import CloudUploadRounded from '@mui/icons-material/CloudUploadRounded'
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { usePendingUploads } from '@/hooks/usePendingUploads.jsx'
import { removePendingUpload } from '@/services/offline/pendingUploads.js'

// A waiting upload's preview: the file itself (an object URL), a PDF's icon.
function Preview({ file }) {
  const url = useMemo(() => (file?.type?.startsWith('image/') ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])
  return url ? <Box component="img" src={url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <PictureAsPdfRounded color="primary" fontSize="large" />
}

// The photos or maps added offline and still waiting to upload (filter:
// which - e.g. a cave's photos), each with its preview, "Waiting to upload"
// (or "Upload failed") and a button to cancel or remove it. onRemoved(item):
// told after one is removed (the edit form drops its map from the list).
export default function PendingUploadsStrip({ filter, onRemoved, sx }) {
  const { t } = useTranslation('offline', { keyPrefix: 'pending' })
  const [openSnackbar] = useSnackbar()
  const items = usePendingUploads(filter)
  if (items.length === 0) return null

  async function remove(item) {
    await removePendingUpload(item.id)
    onRemoved?.(item)
    openSnackbar(t('cancelled'))
  }

  return (
    <Box className="oc-pending-uploads" component="ul" sx={[{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: 1 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {items.map((item) => {
        const failed = item.state === 'failed'
        const label = item.kind === 'map' ? item.details?.title || item.name : item.name
        return (
          <Box component="li" key={item.id} className="oc-pending-uploads--item" sx={{ width: 120, flexShrink: 0 }}>
            <Box sx={{ position: 'relative', height: 90, borderRadius: 2, overflow: 'hidden', bgcolor: 'action.hover', display: 'grid', placeItems: 'center', opacity: failed ? 1 : 0.75 }}>
              <Preview file={item.file} />
              <Tooltip title={failed ? t('remove') : t('cancel')}>
                <IconButton size="small" onClick={() => remove(item)} aria-label={`${failed ? t('remove') : t('cancel')}: ${label}`} sx={{ position: 'absolute', top: 4, right: 4, color: 'common.white', bgcolor: 'rgb(0 0 0 / 0.5)', '&:hover': { bgcolor: 'rgb(0 0 0 / 0.65)' } }}>
                  <CloseRounded />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, color: failed ? 'error.main' : 'text.secondary' }}>
              {failed ? <ErrorOutlineRounded sx={{ fontSize: 16 }} /> : <CloudUploadRounded sx={{ fontSize: 16 }} />}
              <Typography variant="caption" noWrap>
                {failed ? t('failed') : t('waiting')}
              </Typography>
            </Box>
            <Typography variant="caption" component="div" noWrap title={label} sx={{ color: 'text.secondary' }}>
              {label}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
