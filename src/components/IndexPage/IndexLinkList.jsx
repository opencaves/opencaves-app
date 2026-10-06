import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, IconButton, ListItemButton, Tooltip } from '@mui/material'
import MapOutlined from '@mui/icons-material/MapOutlined'
import SistemaArrow from '@/components/SistemaArrow.jsx'
import MapOffOutlined from './MapOffOutlined.jsx'

// Links to caves or cave systems, in as many columns as the page's width
// holds (one on phones), each a block button: the whole row is the link
// (its primary action), with a state layer on hover and focus. items:
// { key, to, label, color, secondary, mapTo } - color: a sistema's colour, as
// a line arrow before its name (SistemaArrow); secondary: muted text on a second line (a cave's
// system), on one line (cut with an ellipsis) - a long name wraps;
// mapTo: the record on the map, the row's secondary action - a map icon at
// its end, shown on hover or focus (always on touch screens); noMap: the
// icon disabled (a cave without coordinates isn't on the map).
export default function IndexLinkList({ items, className }) {
  const { t } = useTranslation('indexPages')
  return (
    <Box
      component="ul"
      className={['oc-index-link-list', className].filter(Boolean).join(' ')}
      sx={{
        listStyle: 'none',
        m: 0,
        mx: -1.5,
        p: 0,
        columnWidth: '15rem',
        columnGap: 2,
        '& > li': { breakInside: 'avoid', display: 'flex', alignItems: 'center', borderRadius: 2, '&:hover, &:focus-within': { bgcolor: 'action.hover' } },
        '& .oc-index-link-list--map': { opacity: 0, transition: 'opacity 120ms' },
        '& > li:hover .oc-index-link-list--map, & > li:focus-within .oc-index-link-list--map': { opacity: 1 },
        '@media (hover: none)': { '& .oc-index-link-list--map': { opacity: 1 } },
      }}
    >
      {items.map(({ key, to, label, color, secondary, mapTo, noMap }) => (
        <li key={key}>
          <ListItemButton
            className="oc-index-link-list--link"
            component={RouterLink}
            to={to}
            disableGutters
            sx={{ flex: 1, minWidth: 0, minHeight: 40, px: 1.5, py: 0.75, borderRadius: 2, gap: 1, alignItems: 'center', '&:hover': { bgcolor: 'transparent' } }}
          >
            {color && <SistemaArrow color={color} sx={{ fontSize: '1.3rem' }} />}
            {/* The name (wrapping when too long), the muted text under it. */}
            <Box component="span" sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <Box component="span" sx={{ typography: 'body1', color: 'primary.main', overflowWrap: 'anywhere' }}>
                {label}
              </Box>
              {secondary && (
                <Box component="span" className="oc-index-link-list--secondary" sx={{ typography: 'body2', color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {secondary}
                </Box>
              )}
            </Box>
          </ListItemButton>
          {mapTo && noMap && (
            <Tooltip title={t('notOnMap')}>
              {/* A disabled button fires no events: the tooltip is on its wrapper. */}
              <span className="oc-index-link-list--map" style={{ marginRight: 4 }}>
                <IconButton disabled aria-label={t('notOnMap')}>
                  <MapOffOutlined fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {mapTo && !noMap && (
            <Tooltip title={t('onMap')}>
              <IconButton className="oc-index-link-list--map" component={RouterLink} to={mapTo} aria-label={t('onMapOf', { name: typeof label === 'string' ? label : '' })} sx={{ mr: 0.5, color: 'text.secondary' }}>
                <MapOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </li>
      ))}
    </Box>
  )
}
