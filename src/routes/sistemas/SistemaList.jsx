import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Box, IconButton, InputAdornment, List, ListItem, ListItemButton, ListItemText, TextField, Tooltip, Typography } from '@mui/material'
import PageFab from '@/components/PageFab.jsx'
import AddRounded from '@mui/icons-material/AddRounded'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import SistemaModel from '@/models/SistemaModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map.js'
import ListSkeleton from '@/components/Skeletons/ListSkeleton.jsx'
import { matchesId } from '@/utils/matchesId.js'
import IndexSection from '@/components/IndexPage/IndexSection.jsx'
import { useSistemaSlugs } from '@/hooks/useIndexData.jsx'

const areasModel = createCollectionModel('areas')

export default function SistemaList() {
  const { t } = useTranslation('dashboard')
  const [sistemas, loading] = SistemaModel.useAll()
  const [areas] = areasModel.useAll()
  const [search, setSearch] = useState('')
  const { setTitle } = useTitle()
  // Each system's edit address: its slug (its id when it has no public page).
  const slugs = useSistemaSlugs()

  useEffect(() => {
    setTitle(t('sistemas'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  const areasById = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const sorted = [...sistemas].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    if (!term) {
      return sorted
    }
    return sorted.filter((sistema) => {
      const areaName = areasById.get(sistema.area) || ''
      return (sistema.name || '').toLowerCase().includes(term) || areaName.toLowerCase().includes(term) || matchesId(sistema.id, term)
    })
  }, [sistemas, search, areasById])

  // Groups by area name (falling back to a "(no area)" bucket), sorted
  // alphabetically, with the unassigned bucket always last.
  const groups = useMemo(() => {
    const byArea = new Map()
    filtered.forEach((sistema) => {
      const areaName = areasById.get(sistema.area) || sistema.area || null
      if (!byArea.has(areaName)) {
        byArea.set(areaName, [])
      }
      byArea.get(areaName).push(sistema)
    })
    return [...byArea.entries()].sort(([a], [b]) => {
      if (a === null) return 1
      if (b === null) return -1
      return a.localeCompare(b)
    })
  }, [filtered, areasById])

  return (
    <div className="oc-sistema-list">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {/* Back to the public list of the systems, this list's /edit counterpart. */}
        <Tooltip title={t('backToSistemaIndex')}>
          <IconButton component={Link} to="/sistemas" aria-label={t('backToSistemaIndex')} sx={{ ml: { xs: 0, sm: -5 } }}>
            <ArrowBackRounded />
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="h5">
          {t('sistemas')}
        </Typography>
      </Box>

      {loading ? (
        <ListSkeleton rows={10} leading="square" count search grouped card />
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('sistemaCount', { count: filtered.length })}
          </Typography>
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            aria-label={t('searchByName')}
            placeholder={t('searchByName')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={(theme) => ({ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: theme.shape.borderRadius * 4, bgcolor: 'var(--oc-page-surface)' } })}
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
          {/* An area per card, its name and count above (as /sistemas). */}
          {groups.map(([areaName, groupSistemas]) => (
            <IndexSection key={areaName ?? 'unassigned'} title={areaName ?? t('noSistemaArea')} count={groupSistemas.length} card cardSx={{ p: 0, overflow: 'hidden' }}>
              <List disablePadding sx={{ '& > li:last-child .MuiListItemButton-root': { borderBottom: 0 } }}>
                  {groupSistemas.map((sistema) => (
                    <ListItem key={sistema.id} disablePadding>
                      <ListItemButton component={Link} to={`/sistemas/${slugs.get(sistema.id) || sistema.id}/edit`} divider>
                        <Box component="span" sx={{ display: 'inline-block', width: 24, height: 24, borderRadius: 0.5, bgcolor: sistema.color || SISTEMA_DEFAULT_COLOR, border: '1px solid', borderColor: 'divider', mr: 1.5, flexShrink: 0 }} />
                        <ListItemText primary={sistema.name || t('unnamed')} secondary={sistema.id} />
                      </ListItemButton>
                    </ListItem>
                  ))}
              </List>
            </IndexSection>
          ))}
        </>
      )}

      <PageFab className="oc-sistema-list--new-fab" to={`/sistemas/${pushId()}/edit`} label={t('newSistema')} icon={<AddRounded />} />
    </div>
  )
}
