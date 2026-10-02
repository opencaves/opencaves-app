import { useId, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, ButtonBase, Divider, Fab, FormControlLabel, FormLabel, Popover, Radio, RadioGroup, Switch, Tooltip, Typography } from '@mui/material'
import LayersRounded from '@mui/icons-material/LayersRounded'
import { setCaveLayerColorBySistema, setCaveLayerEditMode, setCaveLayerScope, setCaveLayerVisible } from '@/redux/slices/caveLayerSlice.jsx'
import { useCaveLayerMaps } from '@/hooks/useCaveLayerMaps.jsx'
import { setMapHidden } from '@/services/caveLayerSettings.js'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'

// A sketch of traced cave passages over the forest, for the layer's tile.
function CavePassagesThumbnail() {
  return (
    <svg viewBox="0 0 72 72" width="100%" height="100%" aria-hidden="true">
      <rect width="72" height="72" fill="#3b5a3e" />
      <path d="M0 52 L72 38" stroke="#6f8a62" strokeWidth="5" />
      <ellipse cx="44" cy="30" rx="9" ry="6" fill="#9ec3d6" opacity="0.6" />
      <path d="M6 20 C18 26 22 14 34 22 S50 34 66 24" fill="none" stroke="#5ec4b6" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M14 60 C22 48 30 56 38 44 S52 46 60 58" fill="none" stroke="#c07ad6" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M34 22 L38 44" stroke="#5ec4b6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// The map's layer button, under the account button: white, or in the primary
// colour while the cave layer (the passages traced from the cave maps,
// CaveLayer) is shown. It opens the layers panel, Google Maps style: a tile
// that shows or hides the layer, then its options - every system or only the
// selected cenote's, coloured by system or in one colour - and, for editors,
// the edit mode (CaveLayer: which map a drawing comes from, and hiding it for
// everyone), with the hidden drawings to show again.
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
          <Typography id={titleId} component="h2" variant="subtitle1" sx={{ mb: 1.5, fontWeight: 500 }}>
            {t('panelTitle')}
          </Typography>
          {/* The layer's tile: outlined in the primary colour while shown. */}
          <ButtonBase className="oc-cave-layer-menu--tile" aria-pressed={visible} onClick={() => dispatch(setCaveLayerVisible(!visible))}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, width: 88, borderRadius: 3, p: 0.5, mb: 1.5 }}>
            <Box sx={{ width: 72, height: 72, borderRadius: 3, overflow: 'hidden', outline: '2px solid', outlineOffset: 2, outlineColor: visible ? 'primary.main' : 'transparent', transition: 'outline-color 150ms' }}>
              <CavePassagesThumbnail />
            </Box>
            <Typography variant="caption" sx={{ fontWeight: visible ? 600 : 400, color: visible ? 'primary.main' : 'text.primary', lineHeight: 1.2, textAlign: 'center' }}>
              {t('title')}
            </Typography>
          </ButtonBase>
          <Divider sx={{ mb: 1.5 }} />
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
