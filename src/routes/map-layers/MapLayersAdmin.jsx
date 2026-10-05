import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Alert, Badge, Box, FormControlLabel, IconButton, InputAdornment, List, ListItem, ListItemButton, ListItemText, Switch, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import MapRounded from '@mui/icons-material/MapRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/config/firebase.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import { useCaveLayerMaps } from '@/hooks/useCaveLayerMaps.jsx'
import { isTrashed } from '@/utils/trash.js'
import { setMapHidden } from '@/services/caveLayerSettings.js'
import { setCaveLayerVisible } from '@/redux/slices/caveLayerSlice.jsx'
import MapCompareViewer from './MapCompareViewer.jsx'
import MapsToProcess from './MapsToProcess.jsx'
import { useMapsToProcess } from './useMapsToProcess.js'

// The zoom that fits a map's extent ([west, south, east, north]) on screen.
function zoomFor(bounds) {
  const span = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1], 0.0005)
  return Math.min(17, Math.max(11, Math.floor(Math.log2(360 / span)) - 1))
}

// top: the fixed app bar's height - the toolbar's, by screen size and
// orientation (theme.mixins.toolbar: minHeight, and the media queries
// changing it).
function belowAppBar(theme) {
  return Object.fromEntries(Object.entries(theme.mixins.toolbar).map(([key, value]) => (key === 'minHeight' ? ['top', value] : [key, { top: value.minHeight }])))
}

// Admins: the maps in the cave layer (maps.json, from the tiles build, by the
// configs' ids), each shown or hidden for everyone (settings/caveLayer.hiddenMaps
// - the same list as the layer's edit mode on the map), with a link to it on the
// map. A row opens its original next to its drawing (MapCompareViewer); on a
// wide screen it shows the scan's thumbnail (the "maps" document with its
// mapImportKey). Its "To process" tab (?tab=toProcess): the maps added in
// the app not turned into the layer yet (MapsToProcess).
export default function MapLayersAdmin() {
  const { t } = useTranslation(['mapLayersAdmin', 'dashboard'])
  const { setTitle } = useTitle()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  // The map whose original is shown (/map-layers/<id>).
  const { mapId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'toProcess' ? 'toProcess' : 'layer'
  const { toProcess, skipped } = useMapsToProcess()
  const sistemas = useSelector((state) => state.data.sistemas)
  const { maps, hiddenMaps } = useCaveLayerMaps()
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState(null)
  const [thumbnails, setThumbnails] = useState(new Map())
  // "Show only hidden": the maps hidden when it was turned on, so one shown
  // again stays in the list (to hide it back) until it's turned off.
  const [onlyHidden, setOnlyHidden] = useState(null)

  // The scans' thumbnails, by importKey and by id (maps added in the app):
  // read once (not those in the trash).
  useEffect(() => {
    getDocs(collection(db, 'maps'))
      .then((snapshot) => setThumbnails(new Map(snapshot.docs.filter((doc) => !isTrashed(doc)).flatMap((doc) => [doc.get('importKey'), doc.id].filter(Boolean).map((key) => [key, doc.get('thumbnailUrl') || doc.get('previewUrl')])))))
      .catch((err) => console.error(err))
  }, [])

  useEffect(() => {
    setTitle(t('title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  const sistemaNames = useMemo(() => new Map((sistemas || []).map((s) => [s.id, s.name?.value || s.name])), [sistemas])
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return Object.entries(maps)
      .map(([id, map]) => ({ id, ...map, sistema: sistemaNames.get(map.sistemaId) || '' }))
      .filter((map) => !onlyHidden || onlyHidden.has(map.id) || hiddenMaps.includes(map.id))
      .filter((map) => !needle || [map.title, map.name, map.sistema, map.date].some((v) => String(v || '').toLowerCase().includes(needle)))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [maps, search, sistemaNames, onlyHidden, hiddenMaps])

  async function toggle(id, shown) {
    setSavingId(id)
    try {
      await setMapHidden(id, !shown)
    } catch (err) {
      console.error(err)
      setError(t('saveError'))
    } finally {
      setSavingId(null)
    }
  }

  const viewing = mapId && maps[mapId] ? { id: mapId, ...maps[mapId] } : null

  // Back to the list: through the history when the list opened it (so the
  // browser's back button and this one agree), else to the list's address.
  function closeViewer() {
    if (location.state?.fromList) navigate(-1)
    else navigate('/map-layers', { replace: true })
  }

  // On the map, with the layer shown.
  function showOnMap(map) {
    dispatch(setCaveLayerVisible(true))
    navigate(`/map#${zoomFor(map.bounds)}/${map.center[1]}/${map.center[0]}`)
  }

  return (
    <Box className="oc-map-layers-admin" sx={{ minHeight: '100%', bgcolor: 'var(--oc-page-surface-translucent)' }}>
      {/* Stays at the top while the list scrolls under it: right under the
          fixed app bar (the toolbar's height, which changes with the screen),
          keeping the page's top margin (pulled into the page's padding). */}
      <Box
        className="oc-map-layers-admin--header"
        sx={(theme) => ({
          position: 'sticky',
          zIndex: 1,
          bgcolor: 'background.paper',
          mt: -2,
          pt: 2,
          pb: 1,
          ...belowAppBar(theme),
        })}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Tooltip title={t('backToDashboard', { ns: 'dashboard' })}>
            <IconButton component={Link} to="/dashboard" aria-label={t('backToDashboard', { ns: 'dashboard' })} sx={{ ml: { xs: 0, sm: -5 } }}>
              <ArrowBackRounded />
            </IconButton>
          </Tooltip>
          <Typography component="h1" variant="h5">
            {t('title')}
          </Typography>
        </Box>

        <Tabs className="oc-map-layers-admin--tabs" value={tab} onChange={(_, value) => setSearchParams(value === 'toProcess' ? { tab: 'toProcess' } : {}, { replace: true })} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab value="layer" label={t('tabs.layer')} />
          <Tab
            value="toProcess"
            label={
              <Badge color="primary" badgeContent={toProcess.length} sx={{ '& .MuiBadge-badge': { right: -14 } }}>
                {t('tabs.toProcess')}
              </Badge>
            }
            sx={{ pr: 4 }}
          />
        </Tabs>

        {tab === 'layer' && (
          <>
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            aria-label={t('searchLabel')}
            placeholder={t('searchLabel')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={(theme) => ({ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: theme.shape.borderRadius * 4 } })}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded />
                  </InputAdornment>
                ),
              },
            }}
          />

          {error && (
            <Alert className="oc-map-layers-admin--error" severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('count', { count: rows.length, hidden: rows.filter((map) => hiddenMaps.includes(map.id)).length })}
            </Typography>
            <FormControlLabel
              className="oc-map-layers-admin--only-hidden"
              control={<Switch size="small" checked={!!onlyHidden} onChange={(e) => setOnlyHidden(e.target.checked ? new Set(hiddenMaps) : null)} />}
              label={t('onlyHidden')}
              labelPlacement="start"
              // At the right end even when wrapped under the count (on a phone),
              // its track lined up with the rows' switches (12px in; a small
              // switch's track is 7px in).
              slotProps={{ typography: { variant: 'body2' } }}
              sx={{ ml: 'auto', mr: '5px' }}
            />
          </Box>
          </>
        )}
      </Box>
      {tab === 'toProcess' && <MapsToProcess toProcess={toProcess} skipped={skipped} />}
      {/* The page scrolls, not the list: no scrollbar narrowing the rows (or
          a scroll area inside the page's, on a phone). */}
      {tab === 'layer' && (
        <List disablePadding>
          {rows.map((map) => {
            const shown = !hiddenMaps.includes(map.id)
            // The scan's thumbnail, or the (larger) image the drawing was traced from.
            const thumbnail = thumbnails.get(map.mapImportKey) || thumbnails.get(map.mapId) || (map.scan && `/tiles/caves/scans/${map.id}.webp`)
            return (
              // MD3: 40dp icon buttons with 24dp icons, 8dp apart (the row's gap)
              // so their 48dp touch targets don't overlap. No side padding: the
              // titles start with the page's content, leaving them more room;
              // the switch keeps its own, or its thumb would be cut.
              <ListItem key={map.id} divider sx={{ py: 1, px: 0, gap: 1, opacity: shown ? 1 : 0.6 }}>
                {/* The thumbnail and text: the original next to the drawing. */}
                <ListItemButton className="oc-map-layers-admin--open" disabled={!map.scan} onClick={() => navigate(`/map-layers/${map.id}`, { state: { fromList: true } })} aria-label={t('showOriginal', { title: map.title })} sx={{ flex: 1, minWidth: 0, gap: 2, px: 1, ml: -1, borderRadius: 2 }}>
                  <Box
                    className="oc-map-layers-admin--thumbnail"
                    sx={{ display: { xs: 'none', md: 'block' }, flex: 'none', width: 80, height: 60, borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover' }}
                  >
                    {thumbnail && <img src={thumbnail} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                  </Box>
                  <ListItemText
                    primary={map.title}
                    secondary={[map.date || t('undated'), map.sistema, map.name].filter(Boolean).join(' · ')}
                    slotProps={{ primary: { sx: { fontSize: 15 } }, secondary: { sx: { fontSize: 13 } } }}
                    sx={{ minWidth: 0 }}
                  />
                </ListItemButton>
                {map.center && (
                  <Tooltip title={t('showOnMap')}>
                    <IconButton aria-label={t('showOnMap')} onClick={() => showOnMap(map)}>
                      <MapRounded />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={shown ? t('hide') : t('show')}>
                  <Switch checked={shown} disabled={savingId === map.id} onChange={(e) => toggle(map.id, e.target.checked)} slotProps={{ input: { 'aria-label': shown ? t('hide') : t('show') } }} />
                </Tooltip>
              </ListItem>
            )
          })}
        </List>
      )}
      <MapCompareViewer map={viewing} open={!!viewing} onClose={closeViewer} />
    </Box>
  )
}
