import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip, Typography } from '@mui/material'
import { Bookmark, BookmarkRemoveOutlined } from '@mui/icons-material'
import { useSavedCaves } from '@/hooks/useSavedCaves.jsx'
import { getData } from '@/services/data-service.jsx'

// The account page's "Saved cenotes" section: every cave the user saved from
// the result pane's Save quick action, most recently saved first.
export default function SavedCavesList() {
  const { t } = useTranslation('account', { keyPrefix: 'savedCaves' })
  const { t: tMap } = useTranslation('map')
  const { loading, savedCaveIds, unsaveCave } = useSavedCaves()
  const caves = useSelector((state) => state.data.caves)

  // Cave names come from the shared cave data, which the map normally loads -
  // make sure it's there when this page is opened directly.
  useEffect(() => {
    getData().catch(() => {})
  }, [])

  // A saved cave that no longer exists (deleted since) is skipped.
  const savedCaves = useMemo(() => {
    const cavesById = new Map(caves.map((cave) => [cave.id, cave]))
    return savedCaveIds.map((id) => cavesById.get(id)).filter(Boolean)
  }, [caves, savedCaveIds])

  return (
    <Box component="section" className="oc-saved-caves-list" sx={{ pt: 3, mb: 3, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography component="h2" variant="h6" sx={{ mb: 1 }}>
        {t('title')}
      </Typography>
      {loading ? (
        <Typography color="text.secondary">{t('loading')}</Typography>
      ) : savedCaves.length === 0 ? (
        <Typography color="text.secondary">{t('empty')}</Typography>
      ) : (
        <List disablePadding>
          {savedCaves.map((cave) => {
            const caveName = cave.name?.value || tMap('caveNameUnknown')
            const sistemaName = cave.sistemas?.[0]?.name
            return (
              <ListItem
                key={cave.id}
                disablePadding
                divider
                secondaryAction={
                  <Tooltip title={t('remove')}>
                    <IconButton edge="end" aria-label={t('removeNamed', { name: caveName })} onClick={() => unsaveCave(cave.id)}>
                      <BookmarkRemoveOutlined />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemButton component={Link} to={`/map/${cave.id}`}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Bookmark sx={{ color: 'var(--oc-marker-saved-badge-color, #ffc107)' }} />
                  </ListItemIcon>
                  <ListItemText primary={caveName} secondary={sistemaName ? t('sistema', { name: sistemaName }) : undefined} />
                </ListItemButton>
              </ListItem>
            )
          })}
        </List>
      )}
    </Box>
  )
}
