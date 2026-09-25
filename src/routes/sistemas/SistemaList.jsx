import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Box, Button, IconButton, List, ListItemButton, ListItemText, Tooltip, Typography } from '@mui/material'
import { ArrowBackRounded } from '@mui/icons-material'
import SistemaModel from '@/models/SistemaModel.js'
import { useTitle } from '@/hooks/useTitle.jsx'

export default function SistemaList() {
  const { t } = useTranslation('dashboard')
  const [sistemas, loading] = SistemaModel.useAll()
  const { setTitle } = useTitle()

  useEffect(() => {
    setTitle('Sistemas')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
