import { useLayoutEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, ButtonBase, Collapse, Divider, Paper, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import { CAVE_LAYER } from '@/config/map.js'
import { useUnits } from '@/hooks/useUnits.jsx'
import { setMapLegendOpen } from '@/redux/slices/preferencesSlice.jsx'
import { saveAccountMapLegendOpen } from '@/services/mapLegendPreference.js'

/**
 * What the cave layer's marks mean (CaveLayer's styles), while the passages
 * are shown. Bottom right, over the map's corner buttons (the locate button,
 * and for editors the edit FAB, rising with its actions when it opens:
 * EditCaveFab's --oc-edit-fab-actions-height) - not under the layer button,
 * where it read as that button's menu. On phones a chip that opens it, riding
 * above the result pane's sheet and fading with the other map controls as it
 * opens (ResultPaneSm's --oc-result-pane-sm-height and --oc-map-controls-*).
 * Open or closed as the person last left it - on this device, and in their
 * account when signed in (services/mapLegendPreference.js) - else open on
 * large screens only.
 *
 * @param {object} props
 * @param {boolean} props.isLarge - A large screen.
 */
export default function CaveLayerLegend({ isLarge }) {
  const { t } = useTranslation('map', { keyPrefix: 'caveLayer.legend' })
  const theme = useTheme()
  const { visible, colorBySistema } = useSelector((/** @type {RootState} */ state) => state.caveLayer)
  const units = useUnits()
  const dispatch = useDispatch()
  const user = useSelector((/** @type {RootState} */ state) => state.session.user)
  const open = useSelector((/** @type {RootState} */ state) => state.preferences?.mapLegendOpen) ?? isLarge
  const isEditor = useSelector((/** @type {RootState} */ state) => state.session.roles).includes('editor')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  // M3's motion for a container opening and closing in place: emphasized
  // decelerate in, emphasized accelerate out (none for reduced motion).
  const { duration, easing } = theme.sys.motion
  const fold = open ? 'emphasizedDecelerate' : 'emphasizedAccelerate'
  const foldMs = reducedMotion ? 0 : duration[fold]
  const paperRef = useRef(null)
  // Its width just before a toggle, to grow or shrink from.
  const fromWidth = useRef(null)

  // The width changes with the height, as one shape (M3): CSS can't
  // transition to an auto width, so it goes from the measured width before
  // to the one after - the content held at its open width meanwhile, so
  // its lines don't rewrap - then back to auto.
  useLayoutEffect(() => {
    const paper = paperRef.current
    const from = fromWidth.current
    fromWidth.current = null
    if (!paper || from == null || reducedMotion) return
    const content = /** @type {HTMLElement|null} */ (paper.querySelector('.oc-cave-layer-legend--content'))
    // Closing: measured as it will be, without its content.
    if (!open && content) content.style.display = 'none'
    const to = paper.getBoundingClientRect().width
    if (content) content.style.display = ''
    if (Math.abs(to - from) < 1) return
    if (content) content.style.width = `${Math.max(from, to)}px`
    paper.style.width = `${from}px`
    paper.getBoundingClientRect() // the start width, before the transition
    paper.style.width = `${to}px`
    const done = (event) => {
      if (event && (event.target !== paper || event.propertyName !== 'width')) return
      // Closing: narrow until its content has left (the Collapse's onExited),
      // or back at auto it would be as wide as that content for a frame.
      if (event && !open) return
      paper.removeEventListener('transitionend', done)
      paper.style.width = ''
      if (content) content.style.width = ''
    }
    paper.addEventListener('transitionend', done)
    return done
  }, [open, reducedMotion])

  if (!visible) return null

  function toggle() {
    fromWidth.current = paperRef.current?.getBoundingClientRect().width ?? null
    dispatch(setMapLegendOpen(!open))
    if (user?.uid && !user.isAnonymous) {
      saveAccountMapLegendOpen(user.uid, !open).catch((error) => console.error(error))
    }
  }

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
      ref={paperRef}
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
        // Over the map's pins, the picked and the current one included
        // (z-index 1: Marker.scss).
        zIndex: 2,
        bottom: `calc(var(--oc-result-pane-sm-height, 0px) + var(--oc-map-control-edge-margin) + 56px + 16px${isEditor ? ' + 56px + 16px' : ''} + var(--oc-edit-fab-actions-height, 0px))`,
        transition: `bottom 200ms ease, opacity 150ms ease, visibility 150ms ease, width ${foldMs}ms ${easing[fold]}`,
        // Its content, held at the open width while the box narrows, is clipped.
        overflow: 'hidden',
        borderRadius: 4,
        bgcolor: (th) => th.vars.sys.color.surfaceContainerHigh,
        maxWidth: 'calc(100vw - 16px)',
        ...(!isLarge && { opacity: 'var(--oc-map-controls-opacity, 1)', visibility: 'var(--oc-map-controls-visibility, visible)' }),
      }}
    >
      <ButtonBase onClick={toggle} aria-expanded={open} sx={{ width: '100%', justifyContent: 'space-between', gap: 1, px: 1.5, py: 1, borderRadius: 4 }}>
        <Typography variant="subtitle2" component="h2">
          {t('title')}
        </Typography>
        {/* Turns with the legend: down to open, up to close. */}
        <ExpandMoreRounded fontSize="small" sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: `transform ${foldMs}ms ${easing[fold]}` }} />
      </ButtonBase>
      {/* Grows from (and folds into) its title; out of the page once folded. */}
      <Collapse
        in={open}
        timeout={reducedMotion ? 0 : { enter: duration.emphasizedDecelerate, exit: duration.emphasizedAccelerate }}
        easing={{ enter: easing.emphasizedDecelerate, exit: easing.emphasizedAccelerate }}
        unmountOnExit
        onExited={() => paperRef.current?.style.removeProperty('width')}
        className="oc-cave-layer-legend--content"
      >
        <Divider className="oc-cave-layer-legend--divider" sx={{ mx: 1.5, mb: 1 }} />
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
          {/* A list item's divider (role none: not an entry of the list). */}
          <Divider component="li" role="none" className="oc-cave-layer-legend--divider" sx={{ my: 0.25 }} />
          <Typography component="li" variant="caption" color="text.secondary">
            {colorBySistema ? t('bySystem') : t('single')}
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  )
}
