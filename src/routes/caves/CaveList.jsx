import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Box, IconButton, InputAdornment, List, ListItem, ListItemButton, ListItemText, TextField, Tooltip, Typography } from '@mui/material'
import PageFab from '@/components/PageFab.jsx'
import AddRounded from '@mui/icons-material/AddRounded'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import CaveModel from '@/models/CaveModel.js'
import SistemaModel from '@/models/SistemaModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map.js'
import ListSkeleton from '@/components/Skeletons/ListSkeleton.jsx'
import IndexSection from '@/components/IndexPage/IndexSection.jsx'
import { matchesId } from '@/utils/matchesId.js'

const areasModel = createCollectionModel('areas')
const NO_AREA = '(no area)'

export default function CaveList() {
  const { t } = useTranslation('dashboard')
  const [caves, loading] = CaveModel.useAll()
  const [sistemas] = SistemaModel.useAll()
  const [areas] = areasModel.useAll()
  const [search, setSearch] = useState('')
  const { setTitle } = useTitle()

  useEffect(() => {
    setTitle(t('caves'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  const areasById = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas])
  // A cave has no area of its own - it comes from whichever sistema it belongs to.
  const areaNameBySistemaId = useMemo(() => new Map(sistemas.map((s) => [s.id, areasById.get(s.area)])), [sistemas, areasById])
  const sistemasById = useMemo(() => new Map(sistemas.map((s) => [s.id, s])), [sistemas])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const sorted = [...caves].sort((a, b) => (a.name?.value || '').localeCompare(b.name?.value || ''))
    if (!term) {
      return sorted
    }
    return sorted.filter((cave) => {
      const areaName = areaNameBySistemaId.get(cave.sistemaId) || ''
      return (cave.name?.value || '').toLowerCase().includes(term) || areaName.toLowerCase().includes(term) || matchesId(cave.id, term)
    })
  }, [caves, search, areaNameBySistemaId])

  // Groups by area name (falling back to a "(no area)" bucket), sorted
  // alphabetically, with the unassigned bucket always last.
  const groups = useMemo(() => {
    const byArea = new Map()
    filtered.forEach((cave) => {
      const areaName = areaNameBySistemaId.get(cave.sistemaId) || NO_AREA
      if (!byArea.has(areaName)) {
        byArea.set(areaName, [])
      }
      byArea.get(areaName).push(cave)
    })
    return [...byArea.entries()].sort(([a], [b]) => {
      if (a === NO_AREA) return 1
      if (b === NO_AREA) return -1
      return a.localeCompare(b)
    })
  }, [filtered, areaNameBySistemaId])

  return (
    <div className="oc-cave-list">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {/* Back to the public list of the cenotes, this list's /edit counterpart. */}
        <Tooltip title={t('backToCaveIndex')}>
          <IconButton component={Link} to="/caves" aria-label={t('backToCaveIndex')} sx={{ ml: { xs: 0, sm: -4 } }}>
            <ArrowBackRounded />
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="h5">
          {t('caves')}
        </Typography>
      </Box>

      {loading ? (
        <ListSkeleton rows={10} leading="square" count search grouped card />
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('caveCount', { count: filtered.length })}
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
          {/* An area per card, its name and count above (as /caves). */}
          {groups.map(([areaName, groupCaves]) => (
            <IndexSection key={areaName} title={areaName} count={groupCaves.length} card cardSx={{ p: 0, overflow: 'hidden' }}>
              <List disablePadding sx={{ '& > li:last-child .MuiListItemButton-root': { borderBottom: 0 } }}>
                  {groupCaves.map((cave) => (
                    <ListItem key={cave.id} disablePadding>
                      <ListItemButton component={Link} to={`/caves/${cave.id}/edit`} divider>
                        <Box component="span" sx={{ display: 'inline-block', width: 24, height: 24, borderRadius: 0.5, bgcolor: sistemasById.get(cave.sistemaId)?.color || SISTEMA_DEFAULT_COLOR, border: '1px solid', borderColor: 'divider', mr: 1.5, flexShrink: 0 }} />
                        <ListItemText primary={cave.name?.value || t('unnamed')} secondary={cave.id} />
                      </ListItemButton>
                    </ListItem>
                  ))}
              </List>
            </IndexSection>
          ))}
        </>
      )}

      <PageFab className="oc-cave-list--new-fab" to={`/caves/${pushId()}/edit`} label={t('newCave')} icon={<AddRounded />} />
    </div>
  )
}
