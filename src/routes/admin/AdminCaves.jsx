import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import pushId from 'unique-push-id'
import { Button, List, ListItemButton, ListItemText, TextField, Typography } from '@mui/material'
import CaveModel from '@/models/CaveModel.js'
import { useTitle } from '@/hooks/useTitle.jsx'

export default function AdminCaves() {
  const [caves, loading] = CaveModel.useAll()
  const [search, setSearch] = useState('')
  const { setTitle } = useTitle()

  useEffect(() => {
    setTitle('Caves')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const sorted = [...caves].sort((a, b) => (a.name?.value || '').localeCompare(b.name?.value || ''))
    if (!term) {
      return sorted
    }
    return sorted.filter(cave => (cave.name?.value || '').toLowerCase().includes(term))
  }, [caves, search])

  return (
    <div>
      <Typography component="h1" variant="h5" sx={{ mb: 2 }}>Caves</Typography>

      <Button component={Link} to={`/admin/caves/${pushId()}`} variant="contained" sx={{ mb: 2, mr: 2 }}>
        New cave
      </Button>

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
            {filtered.map(cave => (
              <ListItemButton key={cave.id} component={Link} to={`/admin/caves/${cave.id}`} divider>
                <ListItemText primary={cave.name?.value || '(unnamed)'} secondary={cave.id} />
              </ListItemButton>
            ))}
          </List>
        </>
      )}
    </div>
  )
}
