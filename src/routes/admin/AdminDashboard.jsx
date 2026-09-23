import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { List, ListItemButton, ListItemText, Typography } from '@mui/material'
import { useTitle } from '@/hooks/useTitle.jsx'

const REFERENCE_COLLECTIONS = [
  { collection: 'accesses', label: 'Accesses' },
  { collection: 'accessibilities', label: 'Accessibilities' },
  { collection: 'sources', label: 'Sources' },
  { collection: 'areas', label: 'Areas' },
  { collection: 'colors', label: 'Colors' },
  { collection: 'languages', label: 'Languages' },
]

export default function AdminDashboard() {
  const { setTitle } = useTitle()

  useEffect(() => {
    setTitle('Admin')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <Typography component="h1" variant="h5" sx={{ mb: 2 }}>Data admin</Typography>

      <Typography component="h2" variant="h6" sx={{ mt: 2, mb: 1 }}>Caves</Typography>
      <List disablePadding>
        <ListItemButton component={Link} to="/caves" divider>
          <ListItemText primary="Manage caves" />
        </ListItemButton>
        <ListItemButton component={Link} to="/sistemas" divider>
          <ListItemText primary="Manage sistemas" />
        </ListItemButton>
      </List>

      <Typography component="h2" variant="h6" sx={{ mt: 3, mb: 1 }}>Reference data</Typography>
      <List disablePadding>
        {REFERENCE_COLLECTIONS.map(({ collection, label }) => (
          <ListItemButton key={collection} component={Link} to={`/admin/reference/${collection}`} divider>
            <ListItemText primary={label} />
          </ListItemButton>
        ))}
      </List>
    </div>
  )
}
