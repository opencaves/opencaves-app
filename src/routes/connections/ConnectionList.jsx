import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AddRounded, ArrowBackRounded, ArrowForwardRounded, SearchRounded } from '@mui/icons-material'
import { Box, Fab, IconButton, InputAdornment, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material'
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

      {loading ? (
        <Typography>{t('loading')}</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('sistemaConnectionCount', { count: filtered.length })}
          </Typography>
          <TextField
            fullWidth
            variant="outlined"
            label={t('searchSistemaConnections')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ mb: 1, '& .MuiOutlinedInput-root': { borderRadius: 999 } }}
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
          <TableContainer component={Paper} sx={{ maxHeight: '70vh' }}>
            <Table stickyHeader size="small" aria-label={t('manageSistemaConnections')}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('childSistema')}</TableCell>
                  <TableCell aria-hidden="true" sx={{ width: 48 }} />
                  <TableCell>{t('parentSistema')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((connection) => (
                  <TableRow key={connection.id} component={Link} to={`/connections/${connection.id}/edit`} hover sx={{ textDecoration: 'none' }}>
                    <TableCell>{sistemaNames.get(connection.sistemaId) || connection.sistemaId}</TableCell>
                    <TableCell aria-hidden="true" sx={{ width: 48, textAlign: 'center' }}>
                      <ArrowForwardRounded fontSize="small" color="action" />
                    </TableCell>
                    <TableCell>{sistemaNames.get(connection.parentSistemaId) || connection.parentSistemaId || t('noParentSistema')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <Fab color="primary" component={Link} to="/connections/new/edit" aria-label={t('newSistemaConnection')} sx={{ position: 'fixed', bottom: (theme) => theme.spacing(3), right: (theme) => theme.spacing(3) }}>
        <AddRounded />
      </Fab>
    </div>
  )
}
