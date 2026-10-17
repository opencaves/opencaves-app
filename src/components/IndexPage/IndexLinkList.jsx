import { memo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Tooltip } from '@mui/material'
import ScubaDivingRounded from '@mui/icons-material/ScubaDivingRounded'
import SistemaArrow from '@/components/SistemaArrow.jsx'
import { MAP_BODY, MAP_OFF_BODY } from './mapIcons.js'
import caveSvg from '@/images/map/cave.svg?raw'
import './IndexLinkList.scss'

// The map icons (MapRounded, and its crossed-out version) as CSS
// masks, painted in the icon's color: no icon component per row.
const svgUrl = (body) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>${body}</svg>`)}")`
const MAP_ICON = svgUrl(MAP_BODY)
// The cave glyph (the nav menu's), before each cave.
const CAVE_ICON = `url("data:image/svg+xml,${encodeURIComponent(caveSvg)}")`
const MAP_OFF_ICON = svgUrl(MAP_OFF_BODY)
const ICON_VARS = { '--oc-index-link-list-cave-icon': CAVE_ICON, '--oc-index-link-list-map-icon': MAP_ICON, '--oc-index-link-list-map-off-icon': MAP_OFF_ICON }

/**
 * Links to caves or cave systems, in as many columns as the page's width
 * holds (one on phones), each a block link: the whole row is the link (its
 * primary action), with a state layer on hover and focus.
 *
 * A list can hold hundreds of rows (/caves): each is plain elements, styled
 * from the list (one set of styles, not one per row) - no ripple, no MUI
 * Tooltip per row, which made the page slow to show and to filter; its icons
 * are CSS masks, and one tooltip for the whole list follows the map icon
 * hovered or focused (or the entrance mark: hovered, or its row's link
 * focused).
 *
 * @param {object} props
 * @param {string} [props.className]
 * @param {object[]} props.items - { key, to, label, cave, color, secondary, mapTo } - cave: a cave icon
 *   before its name; color: a sistema's colour, as
 *   a line arrow before its name ({@link SistemaArrow}); secondary: muted text on a
 *   second line (a cave's system), on one line (cut with an ellipsis) - a long
 *   name wraps; mapTo: the record on the map, the row's secondary action - a
 *   map icon at its end, shown on hover or focus (always on touch screens);
 *   noMap: the icon disabled (a cave without coordinates isn't on the map);
 *   entrance: a cave that's an entrance into its system - a diver icon after
 *   its name, this text its tooltip and its name for screen readers (part of
 *   the link's).
 */
function IndexLinkList({ items, className }) {
  const { t } = useTranslation('indexPages')
  const [tip, setTip] = useState(null)
  // Whatever has a tooltip: a map icon, an entrance mark - or, focused, a
  // row's link holding one.
  const TIPPED = '.oc-index-link-list--map, .oc-index-link-list--entrance'
  const show = (event) => {
    const el = event.target.closest?.(TIPPED) || (event.type === 'focus' ? event.target.querySelector?.('.oc-index-link-list--entrance') : null)
    setTip(el ? { el, title: el.dataset.tip } : null)
  }
  const hide = (event) => {
    if (!event.relatedTarget?.closest?.(TIPPED)) setTip(null)
  }
  return (
    <>
      <Tooltip open={Boolean(tip)} title={tip?.title ?? ''} disableHoverListener disableFocusListener disableTouchListener slotProps={{ popper: { anchorEl: tip?.el } }}>
        <span hidden />
      </Tooltip>
      <Box
        component="ul"
        className={['oc-index-link-list', className].filter(Boolean).join(' ')}
        onMouseOver={show}
        onMouseOut={hide}
        onFocus={show}
        onBlur={hide}
        // Its icons, for IndexLinkList.scss.
        style={ICON_VARS}
      >
        {items.map(({ key, to, label, cave, color, secondary, mapTo, noMap, entrance }) => (
          <li key={key}>
            {/* With a system's arrow: on the name's first line, standing on its baseline. */}
            <RouterLink className="oc-index-link-list--link" to={to} style={color ? { alignItems: 'baseline' } : undefined}>
              {cave && <span className="oc-index-link-list--cave" aria-hidden="true" />}
              {/* Its drawing's bottom on the baseline: down by the room under it in
                its box (19.5 to 24 of 24). */}
            {color && <SistemaArrow color={color} sx={{ fontSize: '1.3rem', flexShrink: 0, transform: 'translateY(0.1875em)' }} />}
              {/* The name (wrapping when too long), the muted text under it. */}
              <span className="oc-index-link-list--text">
                <span className="oc-index-link-list--label">{label}</span>
                {secondary && <span className="oc-index-link-list--secondary">{secondary}</span>}
              </span>
              {entrance && (
                <span className="oc-index-link-list--entrance" role="img" aria-label={entrance} data-tip={entrance}>
                  <ScubaDivingRounded aria-hidden />
                </span>
              )}
            </RouterLink>
            {mapTo && noMap && (
              <span className="oc-index-link-list--map" role="img" aria-disabled="true" aria-label={t('notOnMap')} data-tip={t('notOnMap')} />
            )}
            {mapTo && !noMap && (
              <RouterLink className="oc-index-link-list--map" to={mapTo} aria-label={t('onMapOf', { name: typeof label === 'string' ? label : '' })} data-tip={t('onMap')} />
            )}
          </li>
        ))}
      </Box>
    </>
  )
}

// Memoized: the same rows (a search typed elsewhere on the page) aren't drawn
// again.
export default memo(IndexLinkList)
