import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AddRounded, ArrowBackRounded, ArrowForwardRounded, SearchRounded } from '@mui/icons-material'
import { Box, Fab, IconButton, InputAdornment, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, TextField, Tooltip, Typography } from '@mui/material'
import ConnectionModel from '@/models/ConnectionModel.js'
import SistemaModel from '@/models/SistemaModel.js'
import { useTitle } from '@/hooks/useTitle.jsx'

export default function ConnectionList() {
  const { t } = useTranslation('dashboard')
  const { setTitle } = useTitle()
  const navigate = useNavigate()
  const [connections, loading] = ConnectionModel.useAll()
  const [sistemas] = SistemaModel.useAll()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('child')
  const [sortDirection, setSortDirection] = useState('asc')
  const sistemaNames = new Map(sistemas.map((sistema) => [sistema.id, sistema.name || sistema.id]))
  const filtered = connections
    .filter((connection) => connection.sistemaId && connection.parentSistemaId)
    .filter((connection) => {
      const child = sistemaNames.get(connection.sistemaId) || connection.sistemaId || ''
      const parent = sistemaNames.get(connection.parentSistemaId) || connection.parentSistemaId || ''
      return `${child} ${parent}`.toLowerCase().includes(search.trim().toLowerCase())
    })
    .sort((first, second) => {
      const firstValue = sortBy === 'parent' ? first.parentSistemaId : first.sistemaId
      const secondValue = sortBy === 'parent' ? second.parentSistemaId : second.sistemaId
      const result = (sistemaNames.get(firstValue) || firstValue || '').localeCompare(sistemaNames.get(secondValue) || secondValue || '')
      return sortDirection === 'asc' ? result : -result
    })

  function handleSort(column) {
    if (sortBy === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortBy(column)
    setSortDirection('asc')
  }

  useEffect(() => {
    setTitle(t('manageSistemaConnections'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  return (
    <div className="oc-connection-list">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Tooltip title={t('backToDashboard')}>
          <IconButton component={Link} to="/dashboard" aria-label={t('backToDashboard')} sx={{ ml: { xs: 0, sm: -5 } }}>
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
            size="small"
            variant="outlined"
            aria-label={t('searchSistemaConnections')}
            placeholder={t('searchSistemaConnections')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={(theme) => ({ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: theme.shape.borderRadius * 4 } })}
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
            <Table stickyHeader size="small" aria-label={t('manageSistemaConnections')} sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sortDirection={sortBy === 'child' ? sortDirection : false} sx={{ width: 'calc((100% - 48px) / 2)' }}>
                    <TableSortLabel active={sortBy === 'child'} direction={sortBy === 'child' ? sortDirection : 'asc'} onClick={() => handleSort('child')}>
                      {t('childSistema')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell aria-hidden="true" sx={{ width: 48 }} />
                  <TableCell sortDirection={sortBy === 'parent' ? sortDirection : false} sx={{ width: 'calc((100% - 48px) / 2)' }}>
                    <TableSortLabel active={sortBy === 'parent'} direction={sortBy === 'parent' ? sortDirection : 'asc'} onClick={() => handleSort('parent')}>
                      {t('parentSistema')}
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((connection) => (
                  <TableRow
                    key={connection.id}
                    hover
                    tabIndex={0}
                    onClick={() => navigate(`/connections/${connection.id}/edit`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        navigate(`/connections/${connection.id}/edit`)
                      }
                    }}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ width: 'calc((100% - 48px) / 2)' }}>{sistemaNames.get(connection.sistemaId) || connection.sistemaId}</TableCell>
                    <TableCell aria-hidden="true" sx={{ width: 48, textAlign: 'center' }}>
                      <ArrowForwardRounded fontSize="small" color="action" />
                    </TableCell>
                    <TableCell sx={{ width: 'calc((100% - 48px) / 2)' }}>{sistemaNames.get(connection.parentSistemaId) || connection.parentSistemaId || t('noParentSistema')}</TableCell>
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
