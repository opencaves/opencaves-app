import { memo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Tooltip } from '@mui/material'
import SistemaArrow from '@/components/SistemaArrow.jsx'
import { MAP, SLASH } from './MapOffOutlined.jsx'
import caveSvg from '@/images/map/cave.svg?raw'

// The map icons (MapOutlined, and MapOffOutlined's crossed-out map) as CSS
// masks, painted in the icon's color: no icon component per row.
const svgUrl = (body) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>${body}</svg>`)}")`
const MAP_ICON = svgUrl(`<path d='${MAP}'/>`)
// The cave glyph (the nav menu's), before each cave.
const CAVE_ICON = `url("data:image/svg+xml,${encodeURIComponent(caveSvg)}")`
const MAP_OFF_ICON = svgUrl(`<mask id='m'><rect width='24' height='24' fill='white'/><path d='M2.1 2.1-.02 4.22l19.8 19.8 2.12-2.12z'/></mask><path d='${MAP}' mask='url(%23m)'/><path d='${SLASH}'/>`)

// Links to caves or cave systems, in as many columns as the page's width
// holds (one on phones), each a block link: the whole row is the link (its
// primary action), with a state layer on hover and focus. items:
// { key, to, label, cave, color, secondary, mapTo } - cave: a cave icon
// before its name; color: a sistema's colour, as
// a line arrow before its name (SistemaArrow); secondary: muted text on a
// second line (a cave's system), on one line (cut with an ellipsis) - a long
// name wraps; mapTo: the record on the map, the row's secondary action - a
// map icon at its end, shown on hover or focus (always on touch screens);
// noMap: the icon disabled (a cave without coordinates isn't on the map).
//
// A list can hold hundreds of rows (/caves): each is plain elements, styled
// from the list (one set of styles, not one per row) - no ripple, no MUI
// Tooltip per row, which made the page slow to show and to filter; its icons
// are CSS masks, and one tooltip for the whole list follows the map icon
// hovered or focused.
function IndexLinkList({ items, className }) {
  const { t } = useTranslation('indexPages')
  const [tip, setTip] = useState(null)
  const show = (event) => {
    const el = event.target.closest?.('.oc-index-link-list--map')
    setTip(el ? { el, title: el.dataset.tip } : null)
  }
  const hide = (event) => {
    if (!event.relatedTarget?.closest?.('.oc-index-link-list--map')) setTip(null)
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
        sx={(theme) => ({
          listStyle: 'none',
          m: 0,
          mx: -1.5,
          p: 0,
          columnWidth: '15rem',
          columnGap: 2,
          '& > li': { breakInside: 'avoid', display: 'flex', alignItems: 'center', borderRadius: 2, '&:hover, &:focus-within': { bgcolor: 'action.hover' } },
          '& .oc-index-link-list--link': { flex: 1, minWidth: 0, minHeight: 40, px: 1.5, py: 0.75, borderRadius: 2, display: 'flex', gap: 1, alignItems: 'center', color: 'inherit', textDecoration: 'none' },
          // On the name's first line (body1: 24px high) when it wraps or has a
          // second line.
          '& .oc-index-link-list--cave': { flexShrink: 0, alignSelf: 'flex-start', mt: '2px', width: 20, height: 20, bgcolor: theme.vars.palette.text.secondary, mask: `${CAVE_ICON} center / contain no-repeat` },
          '& .oc-index-link-list--text': { minWidth: 0, display: 'flex', flexDirection: 'column' },
          '& .oc-index-link-list--label': { ...theme.typography.body1, color: theme.vars.palette.primary.main, overflowWrap: 'anywhere' },
          '& .oc-index-link-list--secondary': { ...theme.typography.body2, color: theme.vars.palette.text.secondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
          // The map icon: a 40dp button, its 24dp icon (MD3's icon button).
          '& .oc-index-link-list--map': {
            flexShrink: 0,
            width: 40,
            height: 40,
            mr: 0.5,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            color: theme.vars.palette.text.secondary,
            opacity: 0,
            transition: 'opacity 120ms',
            '&::before': { content: '""', width: 20, height: 20, bgcolor: 'currentColor', mask: `${MAP_ICON} center / contain no-repeat` },
          },
          '& .oc-index-link-list--map[aria-disabled="true"]::before': { maskImage: MAP_OFF_ICON },
          '& a.oc-index-link-list--map:hover': { bgcolor: 'action.hover' },
          '& .oc-index-link-list--map[aria-disabled="true"]': { color: theme.vars.palette.action.disabled },
          '& > li:hover .oc-index-link-list--map, & > li:focus-within .oc-index-link-list--map': { opacity: 1 },
          '@media (hover: none)': { '& .oc-index-link-list--map': { opacity: 1 } },
        })}
      >
        {items.map(({ key, to, label, cave, color, secondary, mapTo, noMap }) => (
          <li key={key}>
            <RouterLink className="oc-index-link-list--link" to={to}>
              {cave && <span className="oc-index-link-list--cave" aria-hidden="true" />}
              {/* On the name's first line, as the cave icon. */}
            {color && <SistemaArrow color={color} sx={{ fontSize: '1.3rem', alignSelf: 'flex-start', mt: '1.6px', flexShrink: 0 }} />}
              {/* The name (wrapping when too long), the muted text under it. */}
              <span className="oc-index-link-list--text">
                <span className="oc-index-link-list--label">{label}</span>
                {secondary && <span className="oc-index-link-list--secondary">{secondary}</span>}
              </span>
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
