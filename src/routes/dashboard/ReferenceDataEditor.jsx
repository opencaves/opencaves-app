import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, List, ListItem, ListItemButton, ListItemText, Tooltip, Typography } from '@mui/material'
import PageFab from '@/components/PageFab.jsx'
import Add from '@mui/icons-material/AddRounded'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import Delete from '@mui/icons-material/DeleteRounded'
import Edit from '@mui/icons-material/EditRounded'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { pickDescription } from '@/services/data-service/types.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'
import { toContentLanguage } from '@/utils/lang.js'
import { DEFAULT_CONTENT_LANGUAGE } from '@/config/contentLanguages.js'
import { REFERENCE_DATA_CONFIGS } from './referenceDataConfigs.js'
import ListSkeleton from '@/components/Skeletons/ListSkeleton.jsx'
import { DASHBOARD_LIST_SX } from '@/components/dashboardSurface.js'
import { slugify } from '@/utils/slug.js'
import IconButtonGroup from '@/components/IconButtonGroup.jsx'

function getHexHue(hex) {
  let value = String(hex || '')
    .trim()
    .replace(/^#/, '')
  if (/^[\da-f]{3,4}$/i.test(value)) {
    value = [...value.slice(0, 3)].map((digit) => digit + digit).join('')
  } else if (/^[\da-f]{6}([\da-f]{2})?$/i.test(value)) {
    value = value.slice(0, 6)
  } else {
    return null
  }

  const channels = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255)
  const [red, green, blue] = channels
  const max = Math.max(...channels)
  const min = Math.min(...channels)
  const delta = max - min
  if (delta === 0) return null

  let hue
  if (max === red) hue = ((green - blue) / delta) % 6
  else if (max === green) hue = (blue - red) / delta + 2
  else hue = (red - green) / delta + 4

  return (hue * 60 + 360) % 360
}

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
  const lang = toContentLanguage(i18n.resolvedLanguage) || DEFAULT_CONTENT_LANGUAGE

  const [model] = useState(() => createCollectionModel(collectionName))
  const [items, loading] = model.useAll()
  const [deleteTarget, setDeleteTarget] = useState(null)
  // Deleting reference data: admins only (as in firestore.rules).
  const isAdmin = useSelector((state) => state.session.roles).includes('admin')
  // Accesses and accessibilities: editors read them, admins change them (adminEdit).
  const canEdit = isAdmin || !config.adminEdit
  // An item's edit address: an area's by its slug (the anchor of its section
  // of /caves); the others' by id (relative to this list).
  const editPath = (item) => (collectionName === 'areas' ? `/areas/${slugify(item.name || item.id)}/edit` : `${item.id}/edit`)
  const sortedItems =
    collectionName === 'colors'
      ? [...items].sort((first, second) => {
          const firstHue = getHexHue(first.hex) ?? 361
          const secondHue = getHexHue(second.hex) ?? 361
          return firstHue - secondHue || String(first.hex || first.id).localeCompare(String(second.hex || second.id))
        })
      : items

  useEffect(() => {
    setTitle(config ? t(`collections.${collectionName}.title`) : collectionName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, t])

  if (!config) {
    return (
      <div className="oc-reference-data-editor">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Tooltip title={t('backToDashboard')}>
            <IconButton component={Link} to="/dashboard" aria-label={t('backToDashboard')} sx={{ ml: { xs: 0, sm: -4 }, mr: -0.5 }}>
              <ArrowBackRounded />
            </IconButton>
          </Tooltip>
          <Typography component="h1" variant="h5" color="error">
            {t('unknownCollection', { name: collectionName })}
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
          <IconButton component={Link} to="/dashboard" aria-label={t('backToDashboard')} sx={{ ml: { xs: 0, sm: -4 }, mr: -0.5 }}>
            <ArrowBackRounded />
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="h5">
          {t(`collections.${collectionName}.title`)}
        </Typography>
      </Box>
      {/* What the list is for (accesses, accessibilities), when it says. */}
      {t(`collections.${collectionName}.description`, { defaultValue: '' }) && (
        <Typography variant="body2" className="oc-reference-data-editor--description" sx={{ color: 'text.secondary', mb: 2 }}>
          {t(`collections.${collectionName}.description`)}
        </Typography>
      )}

      {loading ? (
        <ListSkeleton rows={6} fill={false} card leading={collectionName === 'colors' ? 'square' : null} secondary={config.fields.includes('description')} trailing={!canEdit ? 0 : isAdmin ? 2 : 1} />
      ) : (
        <List disablePadding sx={DASHBOARD_LIST_SX}>
          {sortedItems.map((item, index) => (
            <ListItem
              key={item.id}
              divider={index < sortedItems.length - 1}
              disablePadding
              secondaryAction={
                canEdit && (
                // MD3 standard icon buttons (40dp, 48dp touch targets).
                <IconButtonGroup className="oc-reference-data-editor--actions">
                  <IconButton onClick={() => navigate(editPath(item))} aria-label={t('edit')}>
                    <Edit />
                  </IconButton>
                  {isAdmin && (
                    <IconButton onClick={() => setDeleteTarget(item)} aria-label={t('delete')}>
                      <Delete />
                    </IconButton>
                  )}
                </IconButtonGroup>
                )
              }
            >
              {/* Clear of the action icons (one or two): '&&&' beats MUI's own 48px for a secondary action (as specific as '&&'). */}
              {/* Read-only: the row is no link. */}
              <ListItemButton {...(canEdit ? { component: Link, to: editPath(item) } : { component: 'div', disableRipple: true, tabIndex: -1 })} sx={{ '&&&': { pr: !canEdit ? 2 : isAdmin ? 16 : 10 }, ...(!canEdit && { cursor: 'default', '&:hover': { bgcolor: 'transparent' } }) }}>
                <ListItemText
                  primary={
                    collectionName === 'colors' ? (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box
                          component="span"
                          sx={{
                            display: 'inline-block',
                            width: 24,
                            height: 24,
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
                  // Sources keep a plain description; accesses and accessibilities, one per language.
                  secondary={config.descriptionsField ? pickDescription(item.descriptions, lang) : config.fields.includes('description') ? item.description : undefined}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}

      {canEdit && <PageFab className="oc-reference-data-editor--new-fab" onClick={() => navigate('new/edit')} label={t('newItem')} icon={<Add />} />}

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{t('deleteItemTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('deleteItemConfirm', { name: deleteTarget?.[lang] || deleteTarget?.eng || deleteTarget?.name || deleteTarget?.hex || deleteTarget?.code || deleteTarget?.id })}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{t('cancel')}</Button>
          <Button color="error" onClick={() => handleDelete(deleteTarget.id)}>
            {t('delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
