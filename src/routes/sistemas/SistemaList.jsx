import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Box, Fab, IconButton, List, ListItemButton, ListItemText, ListSubheader, TextField, Tooltip, Typography } from '@mui/material'
import { AddRounded, ArrowBackRounded } from '@mui/icons-material'
import SistemaModel from '@/models/SistemaModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { useTitle } from '@/hooks/useTitle.jsx'

const areasModel = createCollectionModel('areas')
const NO_AREA = '(no area)'

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
      const areaName = areasById.get(sistema.area) || NO_AREA
      if (!byArea.has(areaName)) {
        byArea.set(areaName, [])
      }
      byArea.get(areaName).push(sistema)
    })
    return [...byArea.entries()].sort(([a], [b]) => {
      if (a === NO_AREA) return 1
      if (b === NO_AREA) return -1
      return a.localeCompare(b)
    })
  }, [filtered, areasById])

  return (
    <div className="oc-sistema-list">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Tooltip title={t('backToDashboard')}>
          <IconButton component={Link} to="/dashboard" aria-label={t('backToDashboard')}>
            <ArrowBackRounded />
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="h5">Sistemas</Typography>
      </Box>

      <TextField
        label="Search by name"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2, minWidth: 280 }}
      />

      {loading ? (
        <Typography>Loading…</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{filtered.length} sistema(s)</Typography>
          <List disablePadding sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {groups.map(([areaName, groupSistemas]) => (
              <li key={areaName}>
                <ul style={{ padding: 0 }}>
                  <ListSubheader sx={{ fontSize: '1.125rem', fontWeight: 300 }}>{areaName}</ListSubheader>
                  {groupSistemas.map((sistema) => (
                    <ListItemButton key={sistema.id} component={Link} to={`/sistemas/${sistema.id}/edit`} divider>
                      <ListItemText primary={sistema.name || '(unnamed)'} secondary={sistema.id} />
                    </ListItemButton>
                  ))}
                </ul>
              </li>
            ))}
          </List>
        </>
      )}

      <Fab
        className="oc-sistema-list--new-fab"
        color="primary"
        component={Link}
        to={`/sistemas/${pushId()}/edit`}
        aria-label="New sistema"
        sx={{ position: 'fixed', bottom: (theme) => theme.spacing(3), right: (theme) => theme.spacing(3) }}
      >
        <AddRounded />
      </Fab>
    </div>
  )
}
