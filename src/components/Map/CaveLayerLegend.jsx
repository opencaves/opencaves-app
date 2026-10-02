import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, ButtonBase, Paper, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { ExpandLessRounded, ExpandMoreRounded } from '@mui/icons-material'

// What the cave layer's marks mean (CaveLayer's styles), bottom-right beside
// the "find my location" control, while the passages are shown. On phones a
// chip that opens it, riding above the result pane's sheet and fading with the
// other map controls (ResultPaneSm's --oc-result-pane-sm-height and
// --oc-map-controls-* variables).
export default function CaveLayerLegend({ isLarge }) {
  const { t } = useTranslation('map', { keyPrefix: 'caveLayer.legend' })
  const theme = useTheme()
  const { visible, colorBySistema } = useSelector((state) => state.caveLayer)
  const [open, setOpen] = useState(isLarge)

  if (!visible) return null

  // A line in the layer's colour: a few systems' colours when coloured by
  // system, the single colour otherwise.
  const lineColor = colorBySistema ? `linear-gradient(90deg, #76378a, #00bfa2, #b25d5d)` : theme.palette.primary.light
  const swatch = { width: 28, height: 14, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const items = [
    { key: 'walls', mark: <Box sx={{ width: 26, height: 3, borderRadius: 2, background: lineColor }} /> },
    { key: 'water', mark: <Box sx={{ width: 26, height: 12, borderRadius: 1, background: lineColor, opacity: 0.35 }} /> },
    { key: 'details', mark: <Box sx={{ width: 26, height: 0, borderTop: '1px solid', borderColor: colorBySistema ? '#00bfa2' : theme.palette.primary.light, opacity: 0.7 }} /> },
    { key: 'entrance', mark: <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'info.main', border: '1px solid #fff' }} /> },
    { key: 'depth', mark: <Typography component="span" sx={{ fontSize: 11, fontWeight: 500 }}>12 m</Typography> },
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
        // Beside the geolocate control (16px margin + 56px) with the same 16px gap.
        right: 'calc(16px + 56px + 16px)',
        bottom: isLarge ? '16px' : 'calc(var(--oc-result-pane-sm-height, 0px) + 16px)',
        borderRadius: 4,
        bgcolor: (th) => th.sys.color.surfaceContainerHigh,
        maxWidth: 'calc(100vw - 104px)',
        ...(!isLarge && { opacity: 'var(--oc-map-controls-opacity, 1)', visibility: 'var(--oc-map-controls-visibility, visible)', transition: 'opacity 150ms ease, visibility 150ms ease' }),
      }}
    >
      <ButtonBase onClick={() => setOpen((o) => !o)} aria-expanded={open} sx={{ width: '100%', justifyContent: 'space-between', gap: 1, px: 1.5, py: 1, borderRadius: 4 }}>
        <Typography variant="subtitle2" component="h2">
          {t('title')}
        </Typography>
        {open ? <ExpandMoreRounded fontSize="small" /> : <ExpandLessRounded fontSize="small" />}
      </ButtonBase>
      {open && (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, px: 1.5, pb: 1.5, pt: 0, display: 'grid', gap: 0.75 }}>
          {items.map(({ key, mark }) => (
            <Box component="li" key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={swatch} aria-hidden="true">
                {mark}
              </Box>
              <Typography variant="body2" sx={{ fontSize: 13 }}>
                {t(key)}
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
