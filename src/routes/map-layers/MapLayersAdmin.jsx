import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Alert, Box, FormControlLabel, IconButton, InputAdornment, List, ListItem, ListItemText, Switch, TextField, Tooltip, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import MapRounded from '@mui/icons-material/MapRounded'
import ImageRounded from '@mui/icons-material/ImageRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/config/firebase.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import { useCaveLayerMaps } from '@/hooks/useCaveLayerMaps.jsx'
import { setMapHidden } from '@/services/caveLayerSettings.js'
import { setCaveLayerVisible } from '@/redux/slices/caveLayerSlice.jsx'

// The zoom that fits a map's extent ([west, south, east, north]) on screen.
function zoomFor(bounds) {
  const span = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1], 0.0005)
  return Math.min(17, Math.max(11, Math.floor(Math.log2(360 / span)) - 1))
}

// Admins: the maps in the cave layer (maps.json, from the tiles build, by the
// configs' ids), each shown or hidden for everyone (settings/caveLayer.hiddenMaps
// - the same list as the layer's edit mode on the map), with links to it on the
// map and to the scan it was traced from (the "maps" document with its
// mapImportKey).
export default function MapLayersAdmin() {
  const { t } = useTranslation(['mapLayersAdmin', 'dashboard'])
  const { setTitle } = useTitle()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const sistemas = useSelector((state) => state.data.sistemas)
  const { maps, hiddenMaps } = useCaveLayerMaps()
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState(null)
  const [scans, setScans] = useState(new Map())
  // "Show only hidden": the maps hidden when it was turned on, so one shown
  // again stays in the list (to hide it back) until it's turned off.
  const [onlyHidden, setOnlyHidden] = useState(null)

  // The scans, by importKey: read once.
  useEffect(() => {
    getDocs(collection(db, 'maps'))
      .then((snapshot) => setScans(new Map(snapshot.docs.map((doc) => [doc.get('importKey'), doc.get('url')]))))
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

  // On the map, with the layer shown.
  function showOnMap(map) {
    dispatch(setCaveLayerVisible(true))
    navigate(`/map#${zoomFor(map.bounds)}/${map.center[1]}/${map.center[0]}`)
  }

  return (
    <Box className="oc-map-layers-admin" sx={{ minHeight: '100%', bgcolor: 'rgba(255, 255, 255, 0.9)' }}>
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
          control={<Switch checked={!!onlyHidden} onChange={(e) => setOnlyHidden(e.target.checked ? new Set(hiddenMaps) : null)} />}
          label={t('onlyHidden')}
          labelPlacement="start"
          sx={{ mr: 0 }}
        />
      </Box>
      <List disablePadding sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {rows.map((map) => {
          const shown = !hiddenMaps.includes(map.id)
          const scan = scans.get(map.mapImportKey)
          return (
            <ListItem key={map.id} divider sx={{ py: 1, gap: 1, opacity: shown ? 1 : 0.6 }}>
              <ListItemText
                primary={map.title}
                secondary={[map.date || t('undated'), map.sistema, map.name].filter(Boolean).join(' · ')}
                sx={{ flex: 1, minWidth: 0 }}
              />
              {scan && (
                <Tooltip title={t('openScan')}>
                  <IconButton component="a" href={scan} target="_blank" rel="noopener" aria-label={t('openScan')}>
                    <ImageRounded fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {map.center && (
                <Tooltip title={t('showOnMap')}>
                  <IconButton aria-label={t('showOnMap')} onClick={() => showOnMap(map)}>
                    <MapRounded fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={shown ? t('hide') : t('show')}>
                <Switch edge="end" checked={shown} disabled={savingId === map.id} onChange={(e) => toggle(map.id, e.target.checked)} slotProps={{ input: { 'aria-label': shown ? t('hide') : t('show') } }} />
              </Tooltip>
            </ListItem>
          )
        })}
      </List>
    </Box>
  )
}
