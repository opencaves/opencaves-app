import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Fab, IconButton, List, ListItem, ListItemButton, ListItemText, Tooltip, Typography } from '@mui/material'
import { Add, ArrowBackRounded, Delete, Edit } from '@mui/icons-material'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { pickDescription } from '@/services/data-service/types.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'
import { ISO6391ToISO6392 } from '@/utils/lang.jsx'
import { REFERENCE_DATA_CONFIGS } from './referenceDataConfigs.js'

export default function ReferenceDataEditor() {
  const params = useParams()
  const location = useLocation()
  const collectionName = params.collectionName || location.pathname.split('/').filter(Boolean)[0]
  const config = REFERENCE_DATA_CONFIGS[collectionName]
  const { setTitle } = useTitle()
  const { t, i18n } = useTranslation('dashboard')
  const navigate = useNavigate()
  // descriptions[].lang is stored as a 3-letter code (matching the
  // `languages` collection / cave nameTranslations), not i18next's own
  // 2-letter language code.
  const lang = ISO6391ToISO6392(i18n.resolvedLanguage) || 'eng'

  const [model] = useState(() => createCollectionModel(collectionName))
  const [items, loading] = model.useAll()
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    setTitle(config?.label || collectionName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName])

  if (!config) {
    return (
      <div className="oc-reference-data-editor">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Tooltip title={t('backToDashboard')}>
            <IconButton component={Link} to="/dashboard" aria-label={t('backToDashboard')} sx={{ ml: -5 }}>
              <ArrowBackRounded />
            </IconButton>
          </Tooltip>
          <Typography component="h1" variant="h5" color="error">
            Unknown reference collection: {collectionName}
          </Typography>
        </Box>
      </div>
    )
  }

  async function handleDelete(id) {
    setDeleteTarget(null)
    await model.remove(id)
    invalidateData()
    await getData()
  }

  return (
    <div className="oc-reference-data-editor">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Tooltip title={t('backToDashboard')}>
          <IconButton component={Link} to="/dashboard" aria-label={t('backToDashboard')} sx={{ ml: -5 }}>
            <ArrowBackRounded />
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="h5">
          {config.label}
        </Typography>
      </Box>

      {loading ? (
        <Typography>Loading…</Typography>
      ) : (
        <List disablePadding>
          {items.map((item) => (
            <ListItem
              key={item.id}
              divider
              disablePadding
              secondaryAction={
                <>
                  <IconButton edge="end" onClick={() => navigate(`${item.id}/edit`)} aria-label="Edit">
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton edge="end" onClick={() => setDeleteTarget(item)} aria-label="Delete">
                    <Delete fontSize="small" />
                  </IconButton>
                </>
              }
            >
              <ListItemButton component={Link} to={`${item.id}/edit`} sx={{ pr: 12 }}>
                <ListItemText
                  primary={
                    collectionName === 'colors' ? (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box
                          component="span"
                          sx={{
                            display: 'inline-block',
                            width: 12,
                            height: 12,
                            borderRadius: 0.5,
                            bgcolor: item.hex || 'transparent',
                            border: '1px solid',
                            borderColor: 'divider',
                            mr: 1,
                            flexShrink: 0,
                          }}
                        />
                        {item.hex || item.id}
                      </Box>
                    ) : (
                      item[lang] || item.eng || item.name || item.hex || item.code || item.id
                    )
                  }
                  secondary={config.descriptionsField ? pickDescription(item.descriptions, lang) : undefined}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}

      <Fab color="primary" aria-label="New" onClick={() => navigate('new/edit')} sx={{ position: 'fixed', bottom: 24, right: 24 }}>
        <Add />
      </Fab>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete this item?</DialogTitle>
        <DialogContent>
          <DialogContentText>{deleteTarget?.[lang] || deleteTarget?.eng || deleteTarget?.name || deleteTarget?.hex || deleteTarget?.code || deleteTarget?.id} will be permanently deleted.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" onClick={() => handleDelete(deleteTarget.id)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
