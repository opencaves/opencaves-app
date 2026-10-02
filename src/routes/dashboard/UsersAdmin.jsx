import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { httpsCallable } from 'firebase/functions'
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, FormGroup, IconButton, InputAdornment, List, ListItem, ListItemText, TextField, Tooltip, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import DeleteRounded from '@mui/icons-material/DeleteRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import { functions } from '@/config/firebase.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import ListSkeleton from '@/components/Skeletons/ListSkeleton.jsx'
import { matchesId } from '@/utils/matchesId.js'

const listUsersFn = httpsCallable(functions, 'listUsers')
const setUserRolesFn = httpsCallable(functions, 'setUserRoles')
const deleteUserFn = httpsCallable(functions, 'deleteUser')

const ASSIGNABLE_ROLES = ['editor', 'admin']

export default function UsersAdmin() {
  const { t } = useTranslation(['usersAdmin', 'dashboard'])
  const { setTitle } = useTitle()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [savingUid, setSavingUid] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setTitle(t('title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  useEffect(() => {
    let cancelled = false

    listUsersFn()
      .then((result) => {
        if (!cancelled) {
          setUsers(result.data.users)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const sorted = [...users].sort((a, b) => a.email.localeCompare(b.email))
    if (!term) {
      return sorted
    }
    return sorted.filter((user) => user.email.toLowerCase().includes(term) || matchesId(user.uid, term))
  }, [users, search])

  async function toggleRole(user, role) {
    const nextRoles = user.roles.includes(role) ? user.roles.filter((r) => r !== role) : [...user.roles, role]

    setSavingUid(user.uid)
    setUsers((prev) => prev.map((u) => (u.uid === user.uid ? { ...u, roles: nextRoles } : u)))

    try {
      await setUserRolesFn({ uid: user.uid, roles: nextRoles })
    } catch (err) {
      setError(err.message)
      setUsers((prev) => prev.map((u) => (u.uid === user.uid ? { ...u, roles: user.roles } : u)))
    } finally {
      setSavingUid(null)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteUserFn({ uid: deleteTarget.uid })
      setUsers((prev) => prev.filter((u) => u.uid !== deleteTarget.uid))
      setDeleteTarget(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Box className="oc-users-admin" sx={{ minHeight: '100%', bgcolor: 'rgba(255, 255, 255, 0.9)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Tooltip title={t('backToDashboard', { ns: 'dashboard' })}>
          <IconButton component={Link} to="/dashboard" aria-label={t('backToDashboard', { ns: 'dashboard' })} sx={{ ml: { xs: 0, sm: -5 } }}>
            <ArrowBackRounded />
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="h5">
          {t('title')}
        </Typography>
      </Box>

      <TextField
        fullWidth
        size="small"
        variant="outlined"
        aria-label={t('searchLabel')}
        placeholder={t('searchLabel')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={(theme) => {
          return { mb: 2, '& .MuiOutlinedInput-root': { borderRadius: theme.shape.borderRadius * 4 } }
        }}
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

      {error && (
        <Alert className="oc-users-admin--error" severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <ListSkeleton rows={6} leading={null} count />
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('count', { count: filtered.length })}
          </Typography>
          <List disablePadding sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {filtered.map((user) => (
              <ListItem key={user.uid} divider sx={{ py: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <ListItemText primary={user.email} secondary={user.disabled ? t('disabled') : null} sx={{ flexBasis: 260, flexGrow: 1 }} />
                <FormGroup row>
                  {ASSIGNABLE_ROLES.map((role) => (
                    <FormControlLabel key={role} control={<Checkbox checked={user.roles.includes(role)} disabled={savingUid === user.uid} onChange={() => toggleRole(user, role)} />} label={t(`role.${role}`)} />
                  ))}
                </FormGroup>
                <Tooltip title={t('delete')}>
                  <IconButton edge="end" aria-label={t('delete')} onClick={() => setDeleteTarget(user)}>
                    <DeleteRounded fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        </>
      )}

      <Dialog className="oc-users-admin--delete-dialog" open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{t('deleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('deleteConfirm', { email: deleteTarget?.email })}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            {t('cancel')}
          </Button>
          <Button color="error" onClick={handleDelete} disabled={deleting}>
            {t('delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
