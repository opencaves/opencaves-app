import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, List, ListItem, ListItemText, Tooltip } from '@mui/material'
import CloseRounded from '@mui/icons-material/CloseRounded'
import { useUnits } from '@/hooks/useUnits.jsx'
import { METRES_PER_FOOT } from '@/utils/units.js'
import { PHOTO_GPS_MAX_DISTANCE } from '@/config/mediaPane.js'

const METRES_PER_MILE = 1609.344

// A distance in the person's units: metres or kilometres, feet or miles.
function useFormatDistance() {
  const units = useUnits()
  const { i18n } = useTranslation()
  return (metres) => {
    const format = (value, digits) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: digits }).format(value)
    if (units === 'imperial') {
      const feet = metres / METRES_PER_FOOT
      return feet < 1000 ? `${format(Math.round(feet / 10) * 10, 0)} ft` : `${format(metres / METRES_PER_MILE, 1)} mi`
    }
    return metres < 1000 ? `${format(Math.round(metres / 10) * 10, 0)} m` : `${format(metres / 1000, 1)} km`
  }
}

/**
 * Before an upload: the photos whose GPS position is far from the cenote, to
 * leave out or upload anyway - with several, each can be skipped on its own
 * (the last one skipped, the rest go ahead). Closing it cancels the upload.
 *
 * @param {object} props
 * @param {{file: File, distance: number}[]} props.far
 * @param {(skipped: File[]) => void} props.onDone - Gets the photos skipped.
 */
export default function PhotoGpsCheckDialog({ caveName, far, onDone, onCancel }) {
  const { t } = useTranslation('mediaPane', { keyPrefix: 'addMedia.gpsCheck' })
  const formatDistance = useFormatDistance()
  const previews = useMemo(() => far.map(({ file }) => URL.createObjectURL(file)), [far])
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews])
  const [skipped, setSkipped] = useState([])
  const several = far.length > 1
  const remaining = far.filter(({ file }) => !skipped.includes(file))

  function skipOne(file) {
    const next = [...skipped, file]
    if (next.length === far.length) onDone(next)
    else setSkipped(next)
  }

  return (
    <Dialog className="oc-photo-gps-check-dialog" open onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>{t('title', { count: remaining.length })}</DialogTitle>
      <Tooltip title={t('cancel')}>
        <IconButton aria-label={t('cancel')} onClick={onCancel} sx={{ position: 'absolute', top: 8, right: 8 }}>
          <CloseRounded />
        </IconButton>
      </Tooltip>
      <DialogContent>
        <DialogContentText>{t('text', { count: remaining.length, cave: caveName, distance: formatDistance(PHOTO_GPS_MAX_DISTANCE) })}</DialogContentText>
        <List dense disablePadding sx={{ mt: 1 }}>
          {far.map(({ file, distance }, i) => !skipped.includes(file) && (
            <ListItem key={`${file.name}-${i}`} disableGutters sx={{ py: 1, alignItems: 'center' }}>
              <Box component="img" src={previews[i]} alt="" sx={{ flex: 'none', width: 128, height: 96, objectFit: 'cover', borderRadius: 2, display: 'block', mr: 2 }} />
              {/* The name and distance, the skip button under them: the name keeps the width. */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <ListItemText primary={file.name} secondary={t('distance', { distance: formatDistance(distance) })} slotProps={{ primary: { noWrap: true } }} sx={{ my: 0 }} />
                {several && (
                  <Button className="oc-photo-gps-check-dialog--skip-one" size="small" onClick={() => skipOne(file)} sx={{ mt: 0.5, ml: -0.5 }}>
                    {t('skip', { count: 1 })}
                  </Button>
                )}
              </Box>
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        {/* With several, each is skipped on its own: this one cancels the upload. */}
        {several ? <Button onClick={onCancel}>{t('cancelButton')}</Button> : <Button onClick={() => onDone(far.map(({ file }) => file))}>{t('skip', { count: 1 })}</Button>}
        <Button variant="contained" onClick={() => onDone(skipped)}>{t('uploadAnyway')}</Button>
      </DialogActions>
    </Dialog>
  )
}
