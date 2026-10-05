import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItem, ListItemText, TextField, Tooltip, Typography } from '@mui/material'
import BlockRounded from '@mui/icons-material/BlockRounded'
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded'
import UndoRounded from '@mui/icons-material/UndoRounded'
import { collection, deleteField, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { auth, db } from '@/config/firebase.js'
import { AUDIT_LOG_COLLECTION } from '@/config/collections.js'
import { useAccounts } from '@/routes/audits/useAccounts.js'

// Who added each map and when: its "create" entry in the audit log (admins
// read it), 30 ids a query (Firestore's "in" limit).
function useAdditions(ids) {
  const [additions, setAdditions] = useState(new Map())
  const key = ids.join(',')
  useEffect(() => {
    if (ids.length === 0) return undefined
    let cancelled = false
    const chunks = []
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30))
    Promise.all(chunks.map((chunk) => getDocs(query(collection(db, AUDIT_LOG_COLLECTION), where('collection', '==', 'maps'), where('action', '==', 'create'), where('docId', 'in', chunk)))))
      .then((snapshots) => {
        if (cancelled) return
        const found = new Map()
        snapshots.forEach((snapshot) => snapshot.docs.forEach((entry) => found.set(entry.get('docId'), { by: entry.get('authorId'), at: entry.get('at')?.toDate?.() })))
        setAdditions(found)
      })
      .catch((error) => console.error(error))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return additions
}

// A map's thumbnail, name, systems and who added it; actions at its end.
function MapRow({ map, details, actions }) {
  return (
    <ListItem divider sx={{ py: 1.5, px: 0, gap: 2 }}>
      <Box className="oc-maps-to-process--thumbnail" sx={{ flex: 'none', width: { xs: 96, sm: 160 }, height: { xs: 72, sm: 120 }, borderRadius: 2, overflow: 'hidden', bgcolor: 'action.hover' }}>
        {map.thumbnail && <img src={map.thumbnail} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      </Box>
      <ListItemText primary={map.name} secondary={details} slotProps={{ primary: { sx: { fontSize: 15 } }, secondary: { sx: { fontSize: 13 } } }} sx={{ minWidth: 0 }} />
      {actions}
    </ListItem>
  )
}

// The Map layers page's "To process" tab (admins): the maps added in the app
// that no map-layer config names yet (useMapsToProcess), newest first, each
// with a link to its file and "Not for the layer" (a reason: a profile, a
// dry cave, a sketch...); below, the maps marked so, which can go back.
export default function MapsToProcess({ toProcess, skipped }) {
  const { t, i18n } = useTranslation('mapLayersAdmin')
  const { accountLabel } = useAccounts()
  const additions = useAdditions([...toProcess, ...skipped].map((map) => map.id))
  const [marking, setMarking] = useState(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const added = (map) => {
    const addition = additions.get(map.id)
    if (!addition) return null
    const date = addition.at ? addition.at.toLocaleDateString(i18n.language, { dateStyle: 'medium' }) : ''
    return t('toProcess.added', { date, name: accountLabel(addition.by) })
  }
  const byNewest = (a, b) => (additions.get(b.id)?.at || 0) - (additions.get(a.id)?.at || 0)
  const details = (map, extra) => [map.sistemas.join(', '), added(map), extra].filter(Boolean).join(' · ')
  const openFile = (map) => (
    <Tooltip title={t('toProcess.open')}>
      <IconButton component="a" href={map.url} target="_blank" rel="noopener" aria-label={t('toProcess.openOf', { name: map.name })}>
        <OpenInNewRounded />
      </IconButton>
    </Tooltip>
  )

  async function save(map, fields) {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'maps', map.id), fields)
      setMarking(null)
      setReason('')
    } catch (err) {
      console.error(err)
      setError(t('saveError'))
    } finally {
      setSaving(false)
    }
  }
  const skip = () => save(marking, { layerSkipReason: reason.trim(), layerSkippedBy: auth.currentUser?.uid ?? null, layerSkippedAt: serverTimestamp() })
  const unskip = (map) => save(map, { layerSkipReason: deleteField(), layerSkippedBy: deleteField(), layerSkippedAt: deleteField() })

  return (
    <Box className="oc-maps-to-process">
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t('toProcess.intro')}
      </Typography>
      {toProcess.length === 0 ? (
        <Typography sx={{ py: 3, color: 'text.secondary' }}>{t('toProcess.none')}</Typography>
      ) : (
        <List disablePadding>
          {[...toProcess].sort(byNewest).map((map) => (
            <MapRow
              key={map.id}
              map={map}
              details={details(map)}
              actions={
                <>
                  {openFile(map)}
                  <Tooltip title={t('toProcess.skip')}>
                    <IconButton aria-label={t('toProcess.skipOf', { name: map.name })} onClick={() => setMarking(map)}>
                      <BlockRounded />
                    </IconButton>
                  </Tooltip>
                </>
              }
            />
          ))}
        </List>
      )}

      {skipped.length > 0 && (
        <>
          <Typography component="h2" variant="subtitle1" sx={{ mt: 4, mb: 0.5 }}>
            {t('toProcess.skippedTitle', { count: skipped.length })}
          </Typography>
          <List disablePadding sx={{ opacity: 0.75 }}>
            {[...skipped].sort(byNewest).map((map) => (
              <MapRow
                key={map.id}
                map={map}
                details={details(map, t('toProcess.reason', { reason: map.layerSkipReason }))}
                actions={
                  <>
                    {openFile(map)}
                    <Tooltip title={t('toProcess.unskip')}>
                      <IconButton aria-label={t('toProcess.unskipOf', { name: map.name })} disabled={saving} onClick={() => unskip(map)}>
                        <UndoRounded />
                      </IconButton>
                    </Tooltip>
                  </>
                }
              />
            ))}
          </List>
        </>
      )}

      <Dialog className="oc-maps-to-process--skip-dialog" open={!!marking} onClose={() => !saving && setMarking(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t('toProcess.skipTitle', { name: marking?.name || '' })}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label={t('toProcess.reasonLabel')}
            helperText={t('toProcess.reasonHelp')}
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMarking(null)} disabled={saving}>
            {t('toProcess.cancel')}
          </Button>
          <Button variant="contained" disableElevation onClick={skip} disabled={saving || !reason.trim()}>
            {t('toProcess.confirmSkip')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
