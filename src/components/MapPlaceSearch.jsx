import { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Autocomplete, Box, CircularProgress, InputAdornment, SvgIcon, TextField, Typography } from '@mui/material'
import PlaceRounded from '@mui/icons-material/PlaceRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import PinIcon from '@/images/map/pin.svg?react'
import { REGION_BBOX } from '@/config/map.js'
import { matchesId } from '@/utils/matchesId.js'
import { toServiceLanguage } from '@/utils/lang.js'
import { foldSearch, searchMatcher } from '@/utils/searchText.js'

const GEOCODE_URL = 'https://api.mapbox.com/search/geocode/v6/forward'
const PLACE_LIMIT = 5
const CAVE_LIMIT = 5
const DEBOUNCE_MS = 300
// How close to zoom on a result, by its kind (Mapbox's feature_type, or a
// cenote): the result's own point ends up at the map's center - so under
// "Place on map"'s cross - rather than the middle of its bounding box.
const ZOOM_BY_TYPE = { country: 6, region: 8, district: 10, postcode: 12, place: 12, locality: 14, neighborhood: 14, street: 16, address: 17, cave: 15 }
const DEFAULT_ZOOM = 14
// Same pill as the main map's search bar (SearchBar).
const SEARCH_BAR_SHADOW = '0 2px 4px rgba(0, 0, 0, 0.2), 0 -1px 0px rgba(0, 0, 0, 0.02)'


// A search field over a coordinates map (CoordinatesMapPreview): finds the
// app's own cenotes (by name, alias or ID) and places (Mapbox geocoding, limited
// to the Yucatán, in the UI language, nearest the map's center first).
// Picking one only moves the map - with "Place on map"'s cross showing, the
// cross then sits on it, ready to confirm. centerOffsetY: how far below the
// map's center (px) the result should land, for a cross that isn't centered
// (PlaceOnMapOverlay's, above the phone sheet).
export default function MapPlaceSearch({ mapRef, centerOffsetY = 0 }) {
  const { t, i18n } = useTranslation('resultPane', { keyPrefix: 'edit.placeSearch' })
  const caves = useSelector((state) => state.data.caves)
  const [input, setInput] = useState('')
  // The picked result stays shown in the field.
  const [selected, setSelected] = useState(null)
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const abortRef = useRef(null)

  const query = input.trim()

  const caveOptions = useMemo(() => {
    if (query.length < 2) return []
    const matches = searchMatcher(query)
    return caves
      .filter((cave) => cave.location && ([cave.name?.value, ...(cave.aka || [])].some((name) => matches(foldSearch(name))) || matchesId(cave.id, query)))
      .slice(0, CAVE_LIMIT)
      .map((cave) => ({ kind: 'cave', id: cave.id, label: cave.name?.value || cave.id, detail: cave.aka?.length ? cave.aka.join(', ') : '', center: [cave.location.longitude, cave.location.latitude] }))
  }, [caves, query])

  // Places, debounced and cancelling the previous request. Not for the
  // picked result's own label, just shown back in the field.
  useEffect(() => {
    if (query.length < 2) {
      setPlaces([])
      setLoading(false)
      return undefined
    }
    if (selected && query === selected.label) return undefined
    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      setFailed(false)
      try {
        const center = mapRef.current?.getCenter()
        const params = new URLSearchParams({
          q: query,
          access_token: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
          autocomplete: 'true',
          limit: String(PLACE_LIMIT),
          // Results outside the app's region are of no use here.
          bbox: REGION_BBOX.join(','),
          language: toServiceLanguage(i18n.resolvedLanguage),
          ...(center && { proximity: `${center.lng},${center.lat}` }),
        })
        const response = await fetch(`${GEOCODE_URL}?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`)
        const json = await response.json()
        setPlaces(
          (json.features || []).map((feature) => ({
            kind: 'place',
            id: feature.id,
            label: feature.properties?.name || feature.properties?.full_address || '',
            detail: feature.properties?.place_formatted || '',
            center: feature.geometry.coordinates,
            type: feature.properties?.feature_type,
          })),
        )
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error(error)
          setPlaces([])
          setFailed(true)
        }
      } finally {
        if (abortRef.current === controller) setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, i18n.resolvedLanguage, mapRef])

  useEffect(() => () => abortRef.current?.abort(), [])

  function goTo(option) {
    const map = mapRef.current
    if (!map || !option) return
    const zoom = ZOOM_BY_TYPE[option.kind === 'cave' ? 'cave' : option.type] ?? DEFAULT_ZOOM
    map.flyTo({ center: option.center, zoom, offset: [0, centerOffsetY] })
  }

  const options = [...caveOptions, ...places]
  // Keeps the picked result among the options (Autocomplete expects its
  // value there) once the lists have moved on.
  if (selected && !options.some((option) => option.kind === selected.kind && option.id === selected.id)) options.unshift(selected)
  const noOptionsText = query.length < 2 ? t('hint') : failed ? t('error') : t('noResults')

  return (
    <Autocomplete
      className="oc-map-place-search"
      options={options}
      groupBy={(option) => (option.kind === 'cave' ? t('cenotes') : t('places'))}
      getOptionLabel={(option) => option.label}
      getOptionKey={(option) => `${option.kind}-${option.id}`}
      isOptionEqualToValue={(option, value) => option.kind === value.kind && option.id === value.id}
      // Results are already filtered (cenotes here, places by the API).
      filterOptions={(x) => x}
      inputValue={input}
      onInputChange={(_, value) => setInput(value)}
      value={selected}
      onChange={(_, option) => {
        setSelected(option)
        goTo(option)
      }}
      blurOnSelect
      clearOnBlur={false}
      loading={loading}
      loadingText={t('searching')}
      noOptionsText={noOptionsText}
      forcePopupIcon={false}
      slotProps={{ paper: { elevation: 3, sx: { mt: 0.5, borderRadius: 3 } } }}
      renderOption={({ key, ...props }, option) => (
        <Box component="li" key={key} {...props} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          {option.kind === 'cave' ? <SvgIcon component={PinIcon} inheritViewBox sx={{ mt: 0.25, width: 20, height: 20, color: 'text.secondary', flexShrink: 0 }} /> : <PlaceRounded sx={{ mt: 0.25, color: 'text.secondary', flexShrink: 0 }} fontSize="small" />}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2">{option.label}</Typography>
            {option.detail && (
              <Typography variant="caption" color="text.secondary" component="div">
                {option.detail}
              </Typography>
            )}
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          variant="standard"
          placeholder={t('placeholder')}
          slotProps={{
            ...params.slotProps,
            htmlInput: { ...params.slotProps.htmlInput, 'aria-label': t('label') },
            input: {
              ...params.slotProps.input,
              disableUnderline: true,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <>
                  {loading && <CircularProgress size={18} />}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
          sx={{
            bgcolor: 'background.paper',
            borderRadius: '24px',
            boxShadow: SEARCH_BAR_SHADOW,
            // M3 search bar insets: 16dp to the leading icon, and to the
            // clear icon (in its 40dp button, 8dp from the edge).
            '& .MuiInputBase-root.MuiInputBase-root': { height: 48, pl: 2, pr: 1, py: 0, gap: 0.5 },
            '& .MuiAutocomplete-input': { py: 0 },
            // In the row, not absolutely placed over the rounded edge, and
            // shown whenever there's text (MUI renders it only then), not
            // just on hover or focus.
            '& .MuiAutocomplete-endAdornment': { position: 'static', transform: 'none', display: 'flex', alignItems: 'center', gap: 0.5 },
            '& .MuiAutocomplete-clearIndicator': { visibility: 'visible', width: 40, height: 40, m: 0, '& svg': { fontSize: 24 } },
          }}
        />
      )}
    />
  )
}
