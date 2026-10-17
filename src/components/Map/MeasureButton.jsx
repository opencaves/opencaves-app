import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Fab, Tooltip } from '@mui/material'
import StraightenRounded from '@mui/icons-material/StraightenRounded'
import { setMeasuring } from '@/redux/slices/mapSlice.jsx'
import { track } from '@/utils/track.js'

/**
 * The map's ruler button, right above the "Find my location" button at the
 * bottom right, in its column (on phones too, riding above the result sheet
 * and fading with the other map controls as it opens; the editors' edit FAB
 * and the cave layer's legend sit above it, config/map.js's MEASURE_BUTTON_SLOT). It
 * turns the Measure tool on and off (mapSlice's `measuring`, run by
 * MeasureTool in Map.jsx). White like the map's other buttons, in the
 * primary colour while the tool is on (aria-pressed).
 */
export default function MeasureButton() {
  const { t } = useTranslation('map', { keyPrefix: 'measure' })
  const dispatch = useDispatch()
  const measuring = useSelector((/** @type {RootState} */ state) => state.map.measuring)

  function toggle() {
    if (!measuring) track('measure_start')
    dispatch(setMeasuring(!measuring))
  }

  return (
    <Tooltip title={t('button')} placement="left">
      <Fab
        className={`oc-measure-button${measuring ? ' oc-measure-button--active' : ''}`}
        aria-label={t('button')}
        aria-pressed={measuring}
        onClick={toggle}
        sx={[
          {
            position: 'absolute',
            // The locate button's column and size (Map.scss), 16dp above it:
            // MD3's spacing between stacked FABs.
            right: 'var(--oc-map-control-edge-margin)',
            bottom: 'calc(var(--oc-result-pane-sm-height, 0px) + var(--oc-map-control-edge-margin) + 56px + 16px)',
            width: 56,
            height: 56,
            zIndex: 'var(--oc-app-menu-z-index)',
            opacity: 'var(--oc-map-controls-opacity, 1)',
            visibility: 'var(--oc-map-controls-visibility, visible)',
            transition: 'opacity 150ms ease, visibility 150ms ease',
          },
          measuring
            ? { bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }
            : { bgcolor: 'background.paper', color: 'primary.main', '&:hover': { bgcolor: (theme) => theme.vars.sys.color.surfaceContainerHigh } },
        ]}
      >
        <StraightenRounded />
      </Fab>
    </Tooltip>
  )
}
