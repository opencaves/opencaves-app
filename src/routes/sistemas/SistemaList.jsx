import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Box, Fab, IconButton, InputAdornment, List, ListItem, ListItemButton, ListItemText, ListSubheader, TextField, Tooltip, Typography } from '@mui/material'
import { AddRounded, ArrowBackRounded, SearchRounded } from '@mui/icons-material'
import SistemaModel from '@/models/SistemaModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map.js'

const areasModel = createCollectionModel('areas')

export default function SistemaList() {
  const { t } = useTranslation('dashboard')
  const [sistemas, loading] = SistemaModel.useAll()
  const [areas] = areasModel.useAll()
  const [search, setSearch] = useState('')
  const { setTitle } = useTitle()

  useEffect(() => {
    setTitle('Sistemas')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const areasById = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const sorted = [...sistemas].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    if (!term) {
      return sorted
    }
    return sorted.filter((sistema) => {
      const areaName = areasById.get(sistema.area) || ''
      return (sistema.name || '').toLowerCase().includes(term) || areaName.toLowerCase().includes(term)
    })
  }, [sistemas, search, areasById])

  // Groups by area name (falling back to a "(no area)" bucket), sorted
  // alphabetically, with the unassigned bucket always last.
  const groups = useMemo(() => {
    const byArea = new Map()
    filtered.forEach((sistema) => {
      const areaName = areasById.get(sistema.area) || sistema.area || null
      if (!byArea.has(areaName)) {
        byArea.set(areaName, [])
      }
      byArea.get(areaName).push(sistema)
    })
    return [...byArea.entries()].sort(([a], [b]) => {
      if (a === null) return 1
      if (b === null) return -1
      return a.localeCompare(b)
    })
  }, [filtered, areasById])

  return (
    <div className="oc-sistema-list">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Tooltip title={t('backToDashboard')}>
          <IconButton component={Link} to="/dashboard" aria-label={t('backToDashboard')} sx={{ ml: { xs: 0, sm: -5 } }}>
            <ArrowBackRounded />
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="h5">
          {t('sistemas')}
        </Typography>
      </Box>

      {loading ? (
        <Typography>{t('loading')}</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('sistemaCount', { count: filtered.length })}
          </Typography>
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            aria-label={t('searchByName')}
            placeholder={t('searchByName')}
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
          <List disablePadding sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {groups.map(([areaName, groupSistemas]) => (
              <li key={areaName ?? 'unassigned'}>
                <ul style={{ padding: 0 }}>
                  <ListSubheader sx={{ bgcolor: 'background.paper', fontWeight: 600, borderBottom: '1px solid', borderColor: 'divider' }}>
                    {areaName ?? t('noSistemaArea')} ({groupSistemas.length})
                  </ListSubheader>
                  {groupSistemas.map((sistema) => (
                    <ListItem key={sistema.id} disablePadding>
                      <ListItemButton component={Link} to={`/sistemas/${sistema.id}/edit`} divider>
                        <Box component="span" sx={{ display: 'inline-block', width: 24, height: 24, borderRadius: 0.5, bgcolor: sistema.color || SISTEMA_DEFAULT_COLOR, border: '1px solid', borderColor: 'divider', mr: 1.5, flexShrink: 0 }} />
                        <ListItemText primary={sistema.name || t('unnamed')} secondary={sistema.id} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </ul>
              </li>
            ))}
          </List>
        </>
      )}

      <Fab className="oc-sistema-list--new-fab" color="primary" component={Link} to={`/sistemas/${pushId()}/edit`} aria-label={t('newSistema')} sx={{ position: 'fixed', bottom: (theme) => theme.spacing(3), right: (theme) => theme.spacing(3) }}>
        <AddRounded />
      </Fab>
    </div>
  )
}
