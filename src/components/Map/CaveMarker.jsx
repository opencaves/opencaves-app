import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Marker } from 'react-map-gl/mapbox'
import { SvgIcon } from '@mui/material'
import Bookmark from '@mui/icons-material/BookmarkRounded'
import UnstyledLink from '@/components/UnstyledLink.jsx'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map.js'
import PinIcon from '@/images/map/pin.svg?react'
import PinLocationUnknownIcon from '@/images/map/pin-location-unknown.svg?react'
import { getPinGlyphColor } from '@/utils/pinGlyphColor.js'

// Mapbox gives every marker's wrapper role="img" aria-label="Map marker".
// A cave marker holds its own named link, which that image role would bury
// (an interactive element nested in an image): drop it there.
function unlabelMarker(marker) {
  const el = marker?.getElement()
  el?.removeAttribute('role')
  el?.removeAttribute('aria-label')
}

// One cave's pin on the map. Memoized, with only plain values and stable
// handlers as props: the map re-renders often (panning, zooming, the pins
// being revealed in batches - see Map.jsx), and ~300 pins re-rendering each
// time was a large part of its main-thread work. A pin now only re-renders
// when something it shows changes.
// - current: the open cave's pin; draggable: it can be dragged (edit mode),
//   dragging: it's being dragged (its label hides meanwhile)
// - showLabel: its name is shown (zoomed in enough, or edit mode)
// - editMode: links go to the cave's edit page; replace: links replace the
//   current history entry (from one cave's pane to another's)
export default memo(function CaveMarker(/** @type {{ cave: Cave, current?: boolean, draggable?: boolean, dragging?: boolean, showLabel?: boolean, saved?: boolean, editMode?: boolean, replace?: boolean, onMarkerClick: (event: object, cave: Cave) => void, onDragStart?: () => void, onDragEnd?: (event: object) => void }} */ { cave, current, draggable, dragging, showLabel, saved, editMode, replace, onMarkerClick, onDragStart, onDragEnd }) {
  const { t } = useTranslation('map')
  const caveName = cave.name?.value || t('caveNameUnknown')
  // Never undefined: the glyph's colour is worked out from it (getPinGlyphColor).
  const markerColor = cave.sistemas?.at(-1)?.color || SISTEMA_DEFAULT_COLOR
  const Pin = cave.location.validity === 'valid' ? PinIcon : PinLocationUnknownIcon

  return (
    <Marker
      ref={unlabelMarker}
      longitude={cave.location.longitude}
      latitude={cave.location.latitude}
      anchor="center"
      // Not 'active': react-map-gl updates this class by toggling
      // it, assuming it's still there from the last render, while
      // setActiveMarkerElem adds/removes 'active' itself. Sharing
      // the name let the toggle re-add 'active' to the previous
      // pin after it had already shrunk, leaving it large.
      className={current ? 'oc-map--current-marker' : undefined}
      onClick={(event) => onMarkerClick(event, cave)}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
    >
      {/* Out of the tab order: ~870 pins would make the map a tab trap, and
          every cave is keyboard-reachable through the search bar. */}
      <UnstyledLink to={`/map/${cave.id}${editMode ? '/edit' : ''}`} replace={replace} className="oc-map--marker marker" id={current ? 'active-marker' : null} aria-label={caveName} tabIndex={-1}>
        <SvgIcon inheritViewBox className="oc-map--marker-icon marker-icon" htmlColor={markerColor} style={{ '--oc-pin-glyph-color': getPinGlyphColor(markerColor) }} sx={draggable ? { cursor: 'grab !important' } : undefined}>
          <Pin />
        </SvgIcon>
        {saved && <Bookmark className="oc-map--marker-saved-badge" aria-label={t('savedCave')} />}
        {showLabel && !(draggable && dragging) && <div className="oc-map--marker-label marker-label">{caveName}</div>}
      </UnstyledLink>
    </Marker>
  )
})
