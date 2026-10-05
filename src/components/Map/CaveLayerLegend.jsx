import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, ButtonBase, Paper, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ExpandLessRounded from '@mui/icons-material/ExpandLessRounded'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import { CAVE_LAYER } from '@/config/map.js'
import { useUnits } from '@/hooks/useUnits.jsx'

// What the cave layer's marks mean (CaveLayer's styles), while the passages
// are shown. Bottom right, over the map's corner buttons (the locate button,
// and for editors the edit FAB, rising with its actions when it opens:
// EditCaveFab's --oc-edit-fab-actions-height) - not under the layer button,
// where it read as that button's menu. On phones a chip that opens it, riding
// above the result pane's sheet and fading with the other map controls as it
// opens (ResultPaneSm's --oc-result-pane-sm-height and --oc-map-controls-*).
export default function CaveLayerLegend({ isLarge }) {
  const { t } = useTranslation('map', { keyPrefix: 'caveLayer.legend' })
  const theme = useTheme()
  const { visible, colorBySistema } = useSelector((state) => state.caveLayer)
  const units = useUnits()
  const [open, setOpen] = useState(isLarge)
  const isEditor = useSelector((state) => state.session.roles).includes('editor')

  if (!visible) return null

  // One plain example colour: a system's (any) when coloured by system, the
  // layer's single colour otherwise. Water has its own colour.
  const lineColor = colorBySistema ? '#76378a' : theme.palette.primary.light
  // Wide enough for the letter codes on one line.
  const swatch = { width: 44, height: 16, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const items = [
    { key: 'walls', mark: <Box sx={{ width: 26, height: 3, borderRadius: 2, bgcolor: lineColor }} /> },
    { key: 'water', mark: <Box sx={{ width: 26, height: 12, borderRadius: 1, bgcolor: CAVE_LAYER.WATER_COLOR, opacity: CAVE_LAYER.WATER_OPACITY }} /> },
    { key: 'details', mark: <Box sx={{ width: 26, height: 0, borderTop: '1.5px solid', borderColor: lineColor }} /> },
    { key: 'entrance', mark: <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'info.main', border: '1px solid #fff' }} /> },
    { key: 'arianne', mark: <Box sx={{ width: 26, height: 2, borderRadius: 1, bgcolor: CAVE_LAYER.ARIANNE_COLOR }} /> },
    { key: 'gold', mark: <Box sx={{ width: 26, height: 4, borderRadius: 2, bgcolor: CAVE_LAYER.GOLD_LINE_COLOR }} /> },
    // The maps' conventions (surveySymbols.js): a depth overlined, a height circled.
    { key: 'depth', mark: <Typography component="span" sx={{ fontSize: 11, fontWeight: 600, textDecoration: 'overline' }}>{units === 'imperial' ? '40' : '12'}</Typography> },
    { key: 'height', mark: <Typography component="span" sx={{ fontSize: 10, fontWeight: 600, lineHeight: 1, border: '1.2px solid currentColor', borderRadius: '50%', minWidth: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{units === 'imperial' ? '10' : '3'}</Typography> },
    { key: 'penetration', mark: <Typography component="span" sx={{ fontSize: 10, fontWeight: 500 }}>p.</Typography> },
    { key: 'codes', mark: <Typography component="span" sx={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>r x s z</Typography> },
    { key: 'placeName', mark: <Typography component="span" sx={{ fontSize: 11, fontStyle: 'italic' }}>Aa</Typography> },
    { key: 'flow', mark: <Typography component="span" sx={{ fontSize: 15, lineHeight: 1, color: 'info.dark' }}>➜</Typography> },
  ]

  return (
    <Paper
      className="oc-cave-layer-legend"
      component="aside"
      aria-label={t('title')}
      elevation={2}
      sx={{
        position: 'absolute',
        // Over the locate button (16px from the bottom, 56px tall) and, for
        // editors, the edit FAB (56px, 16px above it) and its open actions;
        // 16px between each, as between those two.
        right: 'var(--oc-map-control-edge-margin)',
        bottom: `calc(var(--oc-result-pane-sm-height, 0px) + var(--oc-map-control-edge-margin) + 56px + 16px${isEditor ? ' + 56px + 16px' : ''} + var(--oc-edit-fab-actions-height, 0px))`,
        transition: 'bottom 200ms ease, opacity 150ms ease, visibility 150ms ease',
        borderRadius: 4,
        bgcolor: (th) => th.sys.color.surfaceContainerHigh,
        maxWidth: 'calc(100vw - 16px)',
        ...(!isLarge && { opacity: 'var(--oc-map-controls-opacity, 1)', visibility: 'var(--oc-map-controls-visibility, visible)' }),
      }}
    >
      <ButtonBase onClick={() => setOpen((o) => !o)} aria-expanded={open} sx={{ width: '100%', justifyContent: 'space-between', gap: 1, px: 1.5, py: 1, borderRadius: 4 }}>
        <Typography variant="subtitle2" component="h2">
          {t('title')}
        </Typography>
        {open ? <ExpandLessRounded fontSize="small" /> : <ExpandMoreRounded fontSize="small" />}
      </ButtonBase>
      {open && (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, px: 1.5, pb: 1.5, pt: 0, display: 'grid', gap: 0.75 }}>
          {items.map(({ key, mark }) => (
            <Box component="li" key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={swatch} aria-hidden="true">
                {mark}
              </Box>
              <Typography variant="body2" sx={{ fontSize: 13 }}>
                {t(key, { unit: units === 'imperial' ? 'ft' : 'm' })}
              </Typography>
            </Box>
          ))}
          <Typography component="li" variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {colorBySistema ? t('bySystem') : t('single')}
          </Typography>
        </Box>
      )}
    </Paper>
  )
}
