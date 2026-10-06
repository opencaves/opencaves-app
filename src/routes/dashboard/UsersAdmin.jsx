import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { httpsCallable } from 'firebase/functions'
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, FormGroup, IconButton, InputAdornment, List, ListItem, ListItemText, TextField, Tooltip, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import DeleteRounded from '@mui/icons-material/DeleteRounded'
import AcUnitRounded from '@mui/icons-material/AcUnitRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import { auth, functions } from '@/config/firebase.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import ListSkeleton from '@/components/Skeletons/ListSkeleton.jsx'
import { DASHBOARD_LIST_SX } from '@/components/dashboardSurface.js'
import { matchesId } from '@/utils/matchesId.js'
import { SEARCH_FIELD_SX } from '@/components/searchFieldSx.js'

const listUsersFn = httpsCallable(functions, 'listUsers')
const setUserRolesFn = httpsCallable(functions, 'setUserRoles')
const deleteUserFn = httpsCallable(functions, 'deleteUser')
const setUserFrozenFn = httpsCallable(functions, 'setUserFrozen')

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
  // Freezing an account (setUserFrozen): all its editing rights removed, the
  // auto-granted editor role withheld, until it's unfrozen. Asked first.
  const [freezeTarget, setFreezeTarget] = useState(null)

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

  async function setFrozen(user, frozen) {
    setFreezeTarget(null)
    setSavingUid(user.uid)
    try {
      const { data } = await setUserFrozenFn({ uid: user.uid, frozen })
      setUsers((prev) => prev.map((u) => (u.uid === user.uid ? { ...u, frozen: data.frozen, roles: data.roles } : u)))
    } catch (err) {
      setError(err.message)
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
    <Box className="oc-users-admin" sx={{ minHeight: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Tooltip title={t('backToDashboard', { ns: 'dashboard' })}>
          <IconButton component={Link} to="/dashboard" aria-label={t('backToDashboard', { ns: 'dashboard' })} sx={{ ml: { xs: 0, sm: -4 }, mr: -0.5 }}>
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
        sx={[SEARCH_FIELD_SX, { mb: 2 }]}
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
        <ListSkeleton rows={6} leading={null} count card />
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('count', { count: filtered.length })}
          </Typography>
          <List disablePadding sx={{ ...DASHBOARD_LIST_SX, maxHeight: '70vh', overflowY: 'auto' }}>
            {filtered.map((user) => (
              <ListItem key={user.uid} divider sx={{ py: 1.5, flexWrap: 'wrap', gap: 1 }}>
                {/* The frozen chip under the email, and an empty slot where an
                    account has no freeze button (its own): the role boxes stay
                    in the same place on every row. */}
                <ListItemText
                  primary={user.email}
                  secondary={
                    (user.disabled || user.frozen) && (
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        {user.frozen && <Chip className="oc-users-admin--frozen" size="small" color="info" icon={<AcUnitRounded />} label={t('frozen')} />}
                        {user.disabled && t('disabled')}
                      </Box>
                    )
                  }
                  slotProps={{ secondary: { component: 'span', sx: { display: 'block' } } }}
                  sx={{ flexBasis: 260, flexGrow: 1 }}
                />
                <FormGroup row>
                  {ASSIGNABLE_ROLES.map((role) => (
                    <FormControlLabel key={role} control={<Checkbox checked={user.roles.includes(role)} disabled={savingUid === user.uid || user.frozen} onChange={() => toggleRole(user, role)} />} label={t(`role.${role}`)} />
                  ))}
                </FormGroup>
                {/* Pushed to the row's end: on a phone, where the roles wrap
                    under the email, they'd otherwise sit right after them.
                    MD3 standard icon buttons: 40dp, 24dp icon, 8dp apart so
                    their 48dp touch targets don't overlap; the last icon 24dp
                    from the row's edge (the list's 16dp padding + 8dp). */}
                <Box className="oc-users-admin--actions" sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
                  {user.uid !== auth.currentUser?.uid ? (
                    <Tooltip title={user.frozen ? t('unfreeze') : t('freeze')}>
                      <IconButton aria-label={user.frozen ? t('unfreeze') : t('freeze')} aria-pressed={user.frozen} color={user.frozen ? 'info' : 'default'} disabled={savingUid === user.uid} onClick={() => (user.frozen ? setFrozen(user, false) : setFreezeTarget(user))}>
                        <AcUnitRounded />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Box className="oc-users-admin--no-freeze" aria-hidden="true" sx={{ width: 40, flex: 'none' }} />
                  )}
                  <Tooltip title={t('delete')}>
                    <IconButton aria-label={t('delete')} onClick={() => setDeleteTarget(user)}>
                      <DeleteRounded />
                    </IconButton>
                  </Tooltip>
                </Box>
              </ListItem>
            ))}
          </List>
        </>
      )}

      <Dialog className="oc-users-admin--freeze-dialog" open={!!freezeTarget} onClose={() => setFreezeTarget(null)}>
        <DialogTitle>{t('freezeTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('freezeConfirm', { email: freezeTarget?.email })}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFreezeTarget(null)}>{t('cancel')}</Button>
          <Button variant="contained" disableElevation onClick={() => setFrozen(freezeTarget, true)}>
            {t('freeze')}
          </Button>
        </DialogActions>
      </Dialog>

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
