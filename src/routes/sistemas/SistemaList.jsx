import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import pushId from 'unique-push-id'
import { Button, List, ListItemButton, ListItemText, Typography } from '@mui/material'
import SistemaModel from '@/models/SistemaModel.js'
import { useTitle } from '@/hooks/useTitle.jsx'

export default function SistemaList() {
  const [sistemas, loading] = SistemaModel.useAll()
  const { setTitle } = useTitle()

  useEffect(() => {
    setTitle('Sistemas')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="oc-sistema-list">
      <Typography component="h1" variant="h5" sx={{ mb: 2 }}>Sistemas</Typography>

      <Button component={Link} to={`/sistemas/${pushId()}/edit`} variant="contained" sx={{ mb: 2 }}>
        New sistema
      </Button>

      {loading ? (
        <Typography>Loading…</Typography>
      ) : (
        <List disablePadding>
          {[...sistemas].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(sistema => (
            <ListItemButton key={sistema.id} component={Link} to={`/sistemas/${sistema.id}/edit`} divider>
              <ListItemText primary={sistema.name || '(unnamed)'} secondary={sistema.id} />
            </ListItemButton>
          ))}
        </List>
      )}
    </div>
  )
}
