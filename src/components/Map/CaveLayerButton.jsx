import { useId, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, Divider, Fab, FormControlLabel, FormLabel, Popover, Radio, RadioGroup, Switch, Tooltip, Typography } from '@mui/material'
import { LayersRounded } from '@mui/icons-material'
import { setCaveLayerColorBySistema, setCaveLayerEditMode, setCaveLayerScope, setCaveLayerVisible } from '@/redux/slices/caveLayerSlice.jsx'
import { useCaveLayerMaps } from '@/hooks/useCaveLayerMaps.jsx'
import { setMapHidden } from '@/services/caveLayerSettings.js'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'

// The map's layer button, under the account button: the cave layer's options
// (the passages traced from the cave maps, CaveLayer) - shown or not, every
// system or only the selected cenote's, coloured by system or in one colour.
// For editors, the edit mode
// (CaveLayer: which map a drawing comes from, and hiding it for everyone),
// with the hidden drawings to show again.
export default function CaveLayerButton({ sx }) {
  const { t } = useTranslation('map', { keyPrefix: 'caveLayer' })
  const dispatch = useDispatch()
  const { caveId } = useParams()
  const { visible, scope, colorBySistema, editMode } = useSelector((state) => state.caveLayer)
  const isEditor = useSelector((state) => state.session.roles).includes('editor')
  const { maps, hiddenMaps } = useCaveLayerMaps()
  const [openSnackbar] = useSnackbar()
  const [anchor, setAnchor] = useState(null)
  const titleId = useId()

  async function showMap(name) {
    try {
      await setMapHidden(name, false)
    } catch (error) {
      console.error(error)
      openSnackbar(t('edit.showError'))
    }
  }

  return (
    <>
      <Tooltip title={t('button')} placement="left">
        {/* Off: white, like the map's other buttons; on: in the primary colour. */}
        <Fab className="oc-cave-layer-button" aria-label={t('button')} aria-haspopup="dialog" aria-expanded={Boolean(anchor)} onClick={(event) => setAnchor(event.currentTarget)}
          sx={visible
            ? { bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' }, ...sx }
            : { bgcolor: 'background.paper', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' }, ...sx }}>
          <LayersRounded />
        </Fab>
      </Tooltip>
      <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { role: 'dialog', 'aria-labelledby': titleId, elevation: 3, sx: (theme) => ({ mt: 1, borderRadius: 7, bgcolor: theme.sys.color.surfaceContainerHigh, width: 'min(320px, calc(100vw - 16px))' }) } }}>
        <Box className="oc-cave-layer-menu" sx={{ p: 2.5 }}>
          <Typography id={titleId} component="h2" variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
            {t('title')}
          </Typography>
          <FormControlLabel control={<Switch checked={visible} onChange={(event) => dispatch(setCaveLayerVisible(event.target.checked))} />} label={t('show')} />
          <Divider sx={{ my: 1.5 }} />
          <FormLabel id={`${titleId}-scope`}>{t('scope')}</FormLabel>
          <RadioGroup aria-labelledby={`${titleId}-scope`} value={scope} onChange={(event) => dispatch(setCaveLayerScope(event.target.value))}>
            <FormControlLabel value="all" control={<Radio size="small" />} label={t('all')} disabled={!visible} />
            <FormControlLabel value="selected" control={<Radio size="small" />} disabled={!visible}
              label={
                <span>
                  {t('selected')}
                  {!caveId && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {t('selectedHint')}
                    </Typography>
                  )}
                </span>
              }
            />
          </RadioGroup>
          <Divider sx={{ my: 1.5 }} />
          <FormLabel id={`${titleId}-colors`}>{t('colors')}</FormLabel>
          <RadioGroup aria-labelledby={`${titleId}-colors`} value={colorBySistema ? 'system' : 'single'} onChange={(event) => dispatch(setCaveLayerColorBySistema(event.target.value === 'system'))}>
            <FormControlLabel value="system" control={<Radio size="small" />} label={t('bySystem')} disabled={!visible} />
            <FormControlLabel value="single" control={<Radio size="small" />} label={t('single')} disabled={!visible} />
          </RadioGroup>
          {isEditor && (
            <Box className="oc-cave-layer-menu--edit">
              <Divider sx={{ my: 1.5 }} />
              <FormControlLabel control={<Switch checked={editMode} onChange={(event) => dispatch(setCaveLayerEditMode(event.target.checked))} />} label={t('edit.mode')} disabled={!visible} />
              <Typography variant="caption" color="text.secondary" component="p">
                {t('edit.modeHint')}
              </Typography>
              {editMode && (
                <>
                  <FormLabel component="p" sx={{ mt: 1.5 }}>
                    {t('edit.hiddenTitle')}
                  </FormLabel>
                  {hiddenMaps.length ? (
                    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, maxHeight: 160, overflowY: 'auto' }}>
                      {hiddenMaps.map((name) => (
                        <Box component="li" key={name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={maps[name]?.title || name}>
                            {maps[name]?.title || name}
                          </Typography>
                          <Button size="small" onClick={() => showMap(name)}>
                            {t('edit.show')}
                          </Button>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.secondary" component="p">
                      {t('edit.noneHidden')}
                    </Typography>
                  )}
                </>
              )}
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            {t('disclaimer')}
          </Typography>
        </Box>
      </Popover>
    </>
  )
}
