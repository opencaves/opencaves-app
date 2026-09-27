import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AddRounded, ArrowBackRounded, ArrowForwardRounded } from '@mui/icons-material'
import { Box, Button, IconButton, List, ListItemButton, ListItemText, TextField, Tooltip, Typography } from '@mui/material'
import ConnectionModel from '@/models/ConnectionModel.js'
import SistemaModel from '@/models/SistemaModel.js'
import { useTitle } from '@/hooks/useTitle.jsx'

export default function ConnectionList() {
  const { t } = useTranslation('dashboard')
  const { setTitle } = useTitle()
  const [connections, loading] = ConnectionModel.useAll()
  const [sistemas] = SistemaModel.useAll()
  const [search, setSearch] = useState('')
  const sistemaNames = new Map(sistemas.map((sistema) => [sistema.id, sistema.name || sistema.id]))
  const filtered = connections
    .filter((connection) => connection.sistemaId && connection.parentSistemaId)
    .filter((connection) => {
      const child = sistemaNames.get(connection.sistemaId) || connection.sistemaId || ''
      const parent = sistemaNames.get(connection.parentSistemaId) || connection.parentSistemaId || ''
      return `${child} ${parent}`.toLowerCase().includes(search.trim().toLowerCase())
    })
    .sort((first, second) => (sistemaNames.get(first.sistemaId) || first.sistemaId || '').localeCompare(sistemaNames.get(second.sistemaId) || second.sistemaId || ''))

  useEffect(() => {
    setTitle(t('manageSistemaConnections'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  return (
    <div className="oc-connection-list">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Tooltip title={t('backToDashboard')}>
          <IconButton component={Link} to="/dashboard" aria-label={t('backToDashboard')} sx={{ ml: -5 }}>
            <ArrowBackRounded />
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="h5">
          {t('manageSistemaConnections')}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 2 }}>
        <TextField label={t('searchSistemaConnections')} value={search} onChange={(event) => setSearch(event.target.value)} sx={{ minWidth: 280, maxWidth: '100%' }} />
        <Button component={Link} to="/sistemas" variant="outlined" size="small" startIcon={<AddRounded />}>
          {t('chooseSistemaToConnect')}
        </Button>
      </Box>

      {loading ? (
        <Typography>{t('loading')}</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('sistemaConnectionCount', { count: filtered.length })}
          </Typography>
          <List disablePadding sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {filtered.map((connection) => (
              <ListItemButton key={connection.id} component={Link} to={`/connections/${connection.id}/edit`} divider>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                      <span>{sistemaNames.get(connection.sistemaId) || connection.sistemaId}</span>
                      <ArrowForwardRounded fontSize="small" color="action" />
                      <span>{sistemaNames.get(connection.parentSistemaId) || connection.parentSistemaId || t('noParentSistema')}</span>
                    </Box>
                  }
                  secondary={connection.connectionDate || connection.note || connection.id}
                />
              </ListItemButton>
            ))}
          </List>
        </>
      )}
    </div>
  )
}
