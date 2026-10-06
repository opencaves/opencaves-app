import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, IconButton, LinearProgress, Skeleton, Tooltip, Typography } from '@mui/material'
import DeleteForeverRounded from '@mui/icons-material/DeleteForeverRounded'
import MapOutlined from '@mui/icons-material/MapOutlined'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'
import RefreshRounded from '@mui/icons-material/RefreshRounded'
import RestoreFromTrashRounded from '@mui/icons-material/RestoreFromTrashRounded'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'
import Picture from '@/components/Picture.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import CaveAsset from '@/models/CaveAsset.js'
import mapsModel from '@/models/MapModel.js'
import { emptyTrash } from '@/models/AuditLogModel.js'
import { When } from './AuditEntryRow.jsx'
import PersonLabel from './PersonLabel.jsx'
import { nameOf } from './auditFormat.js'

// Restores sent at once.
const RESTORE_CONCURRENCY = 8

const itemKey = (item) => `${item.collection}/${item.id}`

// The cards' grid: as many ~180px columns as fit (two on a phone).
const gridSx = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(180px, calc(50% - 8px)), 1fr))', gap: 1.5 }

function PhotoThumbnail({ asset }) {
  return <Picture sources={asset.getSources('resultThumbnail')} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
}

function MapThumbnail({ map }) {
  const [failed, setFailed] = useState(false)
  // thumbnailUrl/previewUrl: the light WebP derivatives the onMap*Uploaded functions make.
  const src = map.thumbnailUrl || map.previewUrl || (map.contentType?.startsWith('image/') && map.url)
  if (src && !failed) {
    return <Box component="img" src={src} alt="" loading="lazy" crossOrigin="anonymous" onError={() => setFailed(true)} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  }
  return <Box sx={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>{map.contentType === 'application/pdf' ? <PictureAsPdfRounded color="action" fontSize="large" /> : <MapOutlined color="action" fontSize="large" />}</Box>
}

// One item: its thumbnail with a checkbox over it, its name (a photo: its
// cave's, linked), and when and by whom it was deleted.
function TrashCard({ item, selected, onToggle, disabled, accountLabel }) {
  const { t } = useTranslation('audits')
  return (
    <Box
      className="oc-trash-card"
      sx={(theme) => ({
        position: 'relative',
        borderRadius: 3,
        overflow: 'hidden',
        border: `1px solid ${selected ? theme.vars.palette.primary.main : theme.vars.sys.color.outlineVariant}`,
        outline: selected ? `1px solid ${theme.vars.palette.primary.main}` : 'none',
        bgcolor: 'background.paper',
      })}
    >
      <Box sx={(theme) => ({ aspectRatio: '4 / 3', bgcolor: theme.vars.sys.color.surfaceContainerHigh })}>{item.collection === 'cavesAssets' ? <PhotoThumbnail asset={item.data} /> : <MapThumbnail map={item.data} />}</Box>
      <Checkbox
        checked={selected}
        disabled={disabled}
        onChange={() => onToggle(itemKey(item))}
        slotProps={{ input: { 'aria-label': t('trash.select', { name: item.title }) } }}
        sx={{ position: 'absolute', top: 4, left: 4, bgcolor: 'var(--oc-page-surface-translucent)', '&:hover': { bgcolor: 'var(--oc-page-surface)' } }}
      />
      <Box sx={{ px: 1.5, py: 1 }}>
        <Typography variant="body2" noWrap title={item.title} sx={{ fontWeight: 500 }}>
          {item.path ? <Link to={item.path}>{item.title}</Link> : item.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          <When value={item.deletedAt} />
        </Typography>
        <PersonLabel uid={item.deletedBy} accountLabel={accountLabel} sx={{ mt: 0.25, maxWidth: '100%' }} />
      </Box>
    </Box>
  )
}

function GridSkeleton() {
  const { t } = useTranslation('app')
  return (
    <Box className="oc-trash-skeleton" aria-busy="true" sx={gridSx}>
      <Box component="span" role="status" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {t('loading')}
      </Box>
      {Array.from({ length: 6 }, (_, i) => (
        <Box key={i} aria-hidden="true">
          <Skeleton variant="rounded" sx={{ width: '100%', height: 'auto', aspectRatio: '4 / 3', borderRadius: 3 }} />
          <Skeleton variant="text" sx={{ width: '70%' }} />
          <Skeleton variant="text" sx={{ width: '45%', fontSize: '0.75rem' }} />
        </Box>
      ))}
    </Box>
  )
}

// The Trash tab: the photos and maps admins deleted, to restore or to delete
// for good (emptyTrash, which also removes their files).
export default function TrashTab({ accountLabel }) {
  const { t } = useTranslation('audits')
  const [openSnackbar] = useSnackbar()
  const caves = useSelector((state) => state.data.caves)
  const [photos, setPhotos] = useState([])
  const [maps, setMaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  // { action: 'restore' | 'delete', done, total } while one runs.
  const [busy, setBusy] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // The items the last permanent deletion couldn't delete, and why.
  const [failures, setFailures] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [trashedPhotos, trashedMaps] = await Promise.all([CaveAsset.getTrashed(), mapsModel.getTrashed()])
      setPhotos(trashedPhotos)
      setMaps(trashedMaps)
      setSelected(new Set())
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sections = useMemo(() => {
    const photoItems = photos.map((asset) => {
      const caveName = nameOf(caves.find((cave) => cave.id === asset.caveId))
      return { collection: 'cavesAssets', id: asset.id, data: asset, title: caveName || asset.caveId || asset.id, path: asset.caveId ? `/map/${asset.caveId}` : null, deletedAt: asset.deletedAt, deletedBy: asset.deletedBy }
    })
    const mapItems = maps.map((map) => ({ collection: 'maps', id: map.id, data: map, title: map.name || map.id, path: null, deletedAt: map.deletedAt, deletedBy: map.deletedBy }))
    return [
      { name: 'photos', items: photoItems },
      { name: 'maps', items: mapItems },
    ]
  }, [photos, maps, caves])

  const allItems = sections.flatMap((section) => section.items)
  const selectedItems = allItems.filter((item) => selected.has(itemKey(item)))
  const allSelected = allItems.length > 0 && selectedItems.length === allItems.length

  const toggle = useCallback((key) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allItems.map(itemKey)))
  }

  async function restore() {
    const items = selectedItems
    let done = 0
    let failed = 0
    setBusy({ action: 'restore', done, total: items.length })
    for (let i = 0; i < items.length; i += RESTORE_CONCURRENCY) {
      const outcomes = await Promise.allSettled(items.slice(i, i + RESTORE_CONCURRENCY).map((item) => (item.collection === 'cavesAssets' ? CaveAsset.restoreById(item.id) : mapsModel.restore(item.id))))
      failed += outcomes.filter((outcome) => outcome.status === 'rejected').length
      done += outcomes.length
      setBusy({ action: 'restore', done, total: items.length })
    }
    setBusy(null)
    openSnackbar(failed ? t('trash.restorePartial', { count: done - failed, failed }) : t('trash.restored', { count: done }), { severity: failed ? null : 'success' })
    await load()
  }

  async function deleteForGood() {
    const items = selectedItems.map(({ collection, id }) => ({ collection, id }))
    setConfirmDelete(false)
    setFailures([])
    setBusy({ action: 'delete', done: 0, total: items.length })
    const { deleted, errors } = await emptyTrash(items, { onProgress: (done, total) => setBusy({ action: 'delete', done, total }) })
    setBusy(null)
    setFailures(errors)
    openSnackbar(errors.length ? t('trash.deletePartial', { count: deleted.length, failed: errors.length }) : t('trash.deleted', { count: deleted.length }), { severity: errors.length ? null : 'success' })
    await load()
  }

  const titleOf = (failure) => allItems.find((item) => item.collection === failure.collection && item.id === failure.id)?.title || failure.id

  return (
    <Box className="oc-audits-trash">
      <Box className="oc-audits-trash--toolbar" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 2 }}>
        <FormControlLabel
          control={<Checkbox checked={allSelected} indeterminate={selectedItems.length > 0 && !allSelected} disabled={allItems.length === 0 || Boolean(busy)} onChange={toggleAll} />}
          label={selectedItems.length > 0 ? t('trash.selected', { count: selectedItems.length }) : t('trash.selectAll')}
        />
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<RestoreFromTrashRounded />} disabled={selectedItems.length === 0 || Boolean(busy)} onClick={restore}>
          {t('trash.restore')}
        </Button>
        <Button variant="outlined" color="error" startIcon={<DeleteForeverRounded />} disabled={selectedItems.length === 0 || Boolean(busy)} onClick={(event) => {
            // Focus off the button first: the dialog hides the page (aria-hidden on
            // #root) before taking focus, which the browser blocks.
            event.currentTarget.blur()
            setConfirmDelete(true)
          }}>
          {t('trash.deleteForever')}
        </Button>
        <Tooltip title={t('refresh')}>
          <span>
            <IconButton aria-label={t('refresh')} disabled={loading || Boolean(busy)} onClick={load}>
              <RefreshRounded />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {busy && (
        <Box className="oc-audits-trash--progress" sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {t(busy.action === 'restore' ? 'trash.restoring' : 'trash.deleting')} {t('progress', { done: busy.done, total: busy.total })}
          </Typography>
          <LinearProgress variant="determinate" value={busy.total ? (busy.done / busy.total) * 100 : 0} />
        </Box>
      )}

      {error && (
        <Alert className="oc-audits-trash--error" severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {t('loadError')} {error}
        </Alert>
      )}

      {failures.length > 0 && (
        <Alert className="oc-audits-trash--failures" severity="warning" sx={{ mb: 2 }} onClose={() => setFailures([])}>
          {t('trash.failures', { count: failures.length })}
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
            {failures.map((failure) => (
              <li key={`${failure.collection}/${failure.id}`}>
                {titleOf(failure)}
                {failure.reason ? ` - ${failure.reason}` : ''}
              </li>
            ))}
          </Box>
        </Alert>
      )}

      {loading ? (
        <GridSkeleton />
      ) : allItems.length === 0 ? (
        !error && (
          <Typography className="oc-audits-trash--empty" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
            {t('trash.empty')}
          </Typography>
        )
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {sections.map(
            (section) =>
              section.items.length > 0 && (
                <Box key={section.name} component="section" className={`oc-audits-trash--${section.name}`}>
                  <Typography component="h2" variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
                    {t(`trash.${section.name}`, { count: section.items.length })}
                  </Typography>
                  <Box sx={gridSx}>
                    {section.items.map((item) => (
                      <TrashCard key={itemKey(item)} item={item} selected={selected.has(itemKey(item))} onToggle={toggle} disabled={Boolean(busy)} accountLabel={accountLabel} />
                    ))}
                  </Box>
                </Box>
              ),
          )}
        </Box>
      )}

      <Dialog className="oc-audits-trash--delete-dialog" open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle sx={{ pr: 7 }}>{t('trash.deleteTitle', { count: selectedItems.length })}</DialogTitle>
        <DialogCloseButton onClick={() => setConfirmDelete(false)} />
        <DialogContent>
          <DialogContentText>{t('trash.deleteConfirm', { count: selectedItems.length })}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>{t('cancel')}</Button>
          <Button variant="contained" color="error" disableElevation onClick={deleteForGood}>
            {t('trash.deleteForeverCount', { count: selectedItems.length })}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
