import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Box, Fab, IconButton, List, ListItemButton, ListItemText, ListSubheader, TextField, Tooltip, Typography } from '@mui/material'
import { AddRounded, ArrowBackRounded } from '@mui/icons-material'
import CaveModel from '@/models/CaveModel.js'
import SistemaModel from '@/models/SistemaModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { useTitle } from '@/hooks/useTitle.jsx'

const areasModel = createCollectionModel('areas')
const NO_AREA = '(no area)'

export default function CaveList() {
  const { t } = useTranslation('dashboard')
  const [caves, loading] = CaveModel.useAll()
  const [sistemas] = SistemaModel.useAll()
  const [areas] = areasModel.useAll()
  const [search, setSearch] = useState('')
  const { setTitle } = useTitle()

  useEffect(() => {
    setTitle('Caves')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const areasById = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas])
  // A cave has no area of its own - it comes from whichever sistema it belongs to.
  const areaNameBySistemaId = useMemo(() => new Map(sistemas.map((s) => [s.id, areasById.get(s.area)])), [sistemas, areasById])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const sorted = [...caves].sort((a, b) => (a.name?.value || '').localeCompare(b.name?.value || ''))
    if (!term) {
      return sorted
    }
    return sorted.filter((cave) => {
      const areaName = areaNameBySistemaId.get(cave.sistemaId) || ''
      return (cave.name?.value || '').toLowerCase().includes(term) || areaName.toLowerCase().includes(term)
    })
  }, [caves, search, areaNameBySistemaId])

  // Groups by area name (falling back to a "(no area)" bucket), sorted
  // alphabetically, with the unassigned bucket always last.
  const groups = useMemo(() => {
    const byArea = new Map()
    filtered.forEach((cave) => {
      const areaName = areaNameBySistemaId.get(cave.sistemaId) || NO_AREA
      if (!byArea.has(areaName)) {
        byArea.set(areaName, [])
      }
      byArea.get(areaName).push(cave)
    })
    return [...byArea.entries()].sort(([a], [b]) => {
      if (a === NO_AREA) return 1
      if (b === NO_AREA) return -1
      return a.localeCompare(b)
    })
  }, [filtered, areaNameBySistemaId])

  return (
    <div className="oc-cave-list">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Tooltip title={t('backToDashboard')}>
          <IconButton component={Link} to="/dashboard" aria-label={t('backToDashboard')}>
            <ArrowBackRounded />
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="h5">Caves</Typography>
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{filtered.length} cave(s)</Typography>
          <List disablePadding sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {groups.map(([areaName, groupCaves]) => (
              <li key={areaName}>
                <ul style={{ padding: 0 }}>
                  <ListSubheader sx={{ fontSize: '1.125rem', fontWeight: 300 }}>{areaName}</ListSubheader>
                  {groupCaves.map((cave) => (
                    <ListItemButton key={cave.id} component={Link} to={`/caves/${cave.id}/edit`} divider>
                      <ListItemText primary={cave.name?.value || '(unnamed)'} secondary={cave.id} />
                    </ListItemButton>
                  ))}
                </ul>
              </li>
            ))}
          </List>
        </>
      )}

      <Fab
        className="oc-cave-list--new-fab"
        color="primary"
        component={Link}
        to={`/caves/${pushId()}/edit`}
        aria-label="New cave"
        sx={{ position: 'fixed', bottom: (theme) => theme.spacing(3), right: (theme) => theme.spacing(3) }}
      >
        <AddRounded />
      </Fab>
    </div>
  )
}
