import { useId, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Divider, Fab, FormControlLabel, FormLabel, Popover, Radio, RadioGroup, Switch, Tooltip, Typography } from '@mui/material'
import { LayersClearRounded, LayersRounded } from '@mui/icons-material'
import { setCaveLayerColorBySistema, setCaveLayerScope, setCaveLayerVisible } from '@/redux/slices/caveLayerSlice.jsx'

// The map's layer button, under the account button: the cave layer's options
// (the passages traced from the cave maps, CaveLayer) - shown or not, every
// system or only the selected cenote's, coloured by system or in one colour.
export default function CaveLayerButton({ sx }) {
  const { t } = useTranslation('map', { keyPrefix: 'caveLayer' })
  const dispatch = useDispatch()
  const { caveId } = useParams()
  const { visible, scope, colorBySistema } = useSelector((state) => state.caveLayer)
  const [anchor, setAnchor] = useState(null)
  const titleId = useId()

  return (
    <>
      <Tooltip title={t('button')} placement="left">
        <Fab className="oc-cave-layer-button" aria-label={t('button')} aria-haspopup="dialog" aria-expanded={Boolean(anchor)} onClick={(event) => setAnchor(event.currentTarget)}
          sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' }, ...sx }}>
          {visible ? <LayersRounded /> : <LayersClearRounded />}
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
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            {t('disclaimer')}
          </Typography>
        </Box>
      </Popover>
    </>
  )
}
