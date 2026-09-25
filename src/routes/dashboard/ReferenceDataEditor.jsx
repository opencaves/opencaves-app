import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Fab, IconButton, List, ListItem, ListItemText, Typography } from '@mui/material'
import { Add, Delete, Edit } from '@mui/icons-material'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { pickDescription } from '@/services/data-service/types.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'
import { ISO6391ToISO6392 } from '@/utils/lang.jsx'
import { REFERENCE_DATA_CONFIGS } from './referenceDataConfigs.js'

export default function ReferenceDataEditor() {
  const { collectionName } = useParams()
  const config = REFERENCE_DATA_CONFIGS[collectionName]
  const { setTitle } = useTitle()
  const { i18n } = useTranslation()
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
      <Typography className="oc-reference-data-editor" color="error">
        Unknown reference collection: {collectionName}
      </Typography>
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
      <Typography component="h1" variant="h5" sx={{ mb: 2 }}>
        {config.label}
      </Typography>

      {loading ? (
        <Typography>Loading…</Typography>
      ) : (
        <List disablePadding>
          {items.map((item) => (
            <ListItem
              key={item.id}
              divider
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
              <ListItemText primary={item[lang] || item.eng || item.name || item.hex || item.code || item.id} secondary={config.descriptionsField ? pickDescription(item.descriptions, lang) : undefined} />
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
