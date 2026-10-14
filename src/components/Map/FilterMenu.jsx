import React, { useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Grid, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, SwipeableDrawer, Switch, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import Close from '@mui/icons-material/CloseRounded'
import { toggleFilterMenu, setResultPaneSmOpen } from '@/redux/slices/appSlice.jsx'
import { setShowValidCoordinates, setShowInvalidCoordinates, setShowUnconfirmedCoordinates, setShowCenoteEntrances, setShowOtherCenotes, setMissing, setShowAreas, setShowAccesses, setShowAccessibilities } from '@/redux/slices/searchSlice.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import { slugify } from '@/utils/slug.js'
import { MISSING_CRITERIA, caveFacts, caveMisses } from '@/utils/caveFilters.js'

// The criteria the map has its own section for (Coordinates): left out of
// Needs help - it shows only located caves, their validity in that section.
const MAP_OWN_CRITERIA = ['coordinates', 'position']
import { useCoverCaveIds } from '@/models/CaveAsset.js'
import './FilterMenu.scss'
import { track } from '@/utils/track.js'

/**
 * The filter menu's head: its title, and its close button.
 *
 * @param {object} props - Also its root's.
 * @param {string} props.title
 * @param {import('react').ReactNode} [props.children]
 */
function FilterMenuHead({ title, children, ...props }) {
  const { t } = useTranslation('filter')
  const dispatch = useDispatch()
  const filterMenuOpen = useSelector((/** @type {RootState} */ state) => state.app.filterMenuOpen)

  function onFilterMenuCloseBtnClick() {
    dispatch(toggleFilterMenu(!filterMenuOpen))
  }

  return (
    <Box className="oc-filter-menu--head">
      <Grid
        container
        sx={{
          gap: 1,
          alignItems: 'center',
          boxShadow: 'var(--mui-shadows-2)',
          position: 'relative',
          zIndex: '1',
          py: 1.5,
          px: 1,
        }}
        {...props}
      >
        <Grid>
          <IconButton className="oc-filter-menu--close" aria-label={t('closeBtn')} onClick={onFilterMenuCloseBtnClick}>
            <Close />
          </IconButton>
        </Grid>
        <Grid size="grow">
          <Typography
            component="h2"
            sx={{
              fontSize: 20,
              fontWeight: 500,
              letterSpacing: '0.0125em',
            }}
          >
            {title}
          </Typography>
        </Grid>
      </Grid>
    </Box>
  )
}

function FilterMenuContent({ children, ...props }) {
  const theme = useTheme()

  return (
    <Grid {...props} size="grow" className="oc-filter-menu--content" sx={{ flex: 1, overflow: 'hidden' }}>
      <Box sx={{ height: '100%', overflowY: 'auto' }}>{children}</Box>
    </Grid>
  )
}

function FilterMenuSectionHeader({ children, ...props }) {
  return (
    <Box
      className="oc-filter-menu--section-header"
      sx={{
        display: 'flex',
        alignItems: 'end',
        minHeight: '48px',
        marginBottom: '.5rem',
      }}
    >
      <Typography
        component="h3"
        sx={{
          lineHeight: 1,
          color: 'var(--mui-palette-text-primary)',
          fontWeight: 500,
          fontSize: '1.125rem',
          px: '1rem',
          bgcolor: 'var(--mui-palette-background-paper)',
        }}
      >
        {children}
      </Typography>
    </Box>
  )
}

// A filter: the whole row is its switch (role switch, its label the row's
// text) - not a button holding a second, unlabelled switch.
/**
 * A filter row (see above).
 *
 * @param {object} props
 * @param {string} props.primary - Its label.
 * @param {string} [props.secondary] - Its description.
 * @param {number | string} [props.nb] - How many caves it covers.
 * @param {boolean} props.checked
 * @param {(event: import('react').MouseEvent) => void} props.onClick
 */
function FilterMenuItem({ primary, secondary, nb, checked, onClick }) {
  return (
    <ListItem disablePadding className="oc-filter-menu--item">
      <ListItemButton onClick={onClick} divider role="switch" aria-checked={Boolean(checked)}>
        <ListItemText
          primary={
            <>
              {primary}
              <Typography variant="mapTextSmall" sx={(theme) => ({ ml: theme.spacing(1) })}>
                {nb}
              </Typography>
            </>
          }
          secondary={secondary && <Typography variant="mapTextSecondary">{secondary}</Typography>}
        />
        {/* What the row's state looks like; inert - out of the tab order
            and hidden from assistive tech (the row is the switch). */}
        <ListItemIcon inert>
          <Switch
            edge="end"
            disableRipple={true}
            checked={checked}
            onChange={() => {}}
            slotProps={{ input: { tabIndex: -1 } }}
            sx={{
              userSelect: 'none',
              '& > .MuiSwitch-switchBase:hover': {
                bgcolor: 'transparent',
              },
              '& > .MuiSwitch-switchBase.Mui-checked:hover': {
                bgcolor: 'transparent',
              },
            }}
          />
        </ListItemIcon>
      </ListItemButton>
    </ListItem>
  )
}

/**
 * The map's filter menu: a drawer on the right, its filters by area, access
 * and accessibility.
 */
export default function MapFilterMenu() {
  const filterMenuOpen = useSelector((/** @type {RootState} */ state) => state.app.filterMenuOpen)

  const showAreas = useSelector((/** @type {RootState} */ state) => state.search.showAreas)
  const showValidCoordinates = useSelector((/** @type {RootState} */ state) => state.search.showValidCoordinates)
  const showInvalidCoordinates = useSelector((/** @type {RootState} */ state) => state.search.showInvalidCoordinates)
  const showUnconfirmedCoordinates = useSelector((/** @type {RootState} */ state) => state.search.showUnconfirmedCoordinates)
  const showCenoteEntrances = useSelector((/** @type {RootState} */ state) => state.search.showCenoteEntrances) !== false
  const showOtherCenotes = useSelector((/** @type {RootState} */ state) => state.search.showOtherCenotes) !== false
  const showAccesses = useSelector((/** @type {RootState} */ state) => state.search.showAccesses)
  const showAccessibilities = useSelector((/** @type {RootState} */ state) => state.search.showAccessibilities)

  const dataStats = useSelector((/** @type {RootState} */ state) => state.map.dataStats)
  const mapData = useSelector((/** @type {RootState} */ state) => state.map.data)
  const missing = useSelector((/** @type {RootState} */ state) => state.search.missing) || []
  const { caveIds: covers } = useCoverCaveIds()

  const dispatch = useDispatch()
  const { t } = useTranslation('filter')

  const handleShowValidCoordinates = () => {
    track('filter_change', { filter: 'valid_coordinates', value: String(!showValidCoordinates) })
    dispatch(setShowValidCoordinates(!showValidCoordinates))
  }

  const handleShowInvalidCoordinates = () => {
    track('filter_change', { filter: 'invalid_coordinates', value: String(!showInvalidCoordinates) })
    dispatch(setShowInvalidCoordinates(!showInvalidCoordinates))
  }

  const handleShowUnconfirmedCoordinates = () => {
    track('filter_change', { filter: 'unconfirmed_coordinates', value: String(!showUnconfirmedCoordinates) })
    dispatch(setShowUnconfirmedCoordinates(!showUnconfirmedCoordinates))
  }

  const handleShowCenoteEntrances = () => {
    track('filter_change', { filter: 'cenote_entrances', value: String(!showCenoteEntrances) })
    dispatch(setShowCenoteEntrances(!showCenoteEntrances))
  }

  const handleShowOtherCenotes = () => {
    track('filter_change', { filter: 'other_cenotes', value: String(!showOtherCenotes) })
    dispatch(setShowOtherCenotes(!showOtherCenotes))
  }

  function handleToggleFilterMenu(open) {
    // console.log('[handleToggleFilterMenu] %o', open)
    return function doToggleFilterMenu(event) {
      if (event && event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
        return
      }

      dispatch(toggleFilterMenu(open))
      dispatch(setResultPaneSmOpen(open))
    }
  }

  function handleShowAccesses(checked, accessKey) {
    track('filter_change', { filter: 'access', value: `${accessKey}:${checked}` })
    const newAccesses = showAccesses.map((access) => {
      if (access.key === accessKey) {
        return { ...access, checked }
      }
      return access
    })
    dispatch(setShowAccesses(newAccesses))
  }

  function handleMissing(value) {
    const on = !missing.includes(value)
    track('filter_change', { filter: 'missing', value: `${value}:${on}` })
    // In the criteria's order, as the caves' list's address.
    dispatch(setMissing(MISSING_CRITERIA.map((criterion) => criterion.value).filter((item) => (item === value ? on : missing.includes(item)))))
  }

  // An area's switch: stored only once turned off or back on (an area the
  // list doesn't name is shown).
  function handleShowAreas(checked, areaKey) {
    track('filter_change', { filter: 'area', value: `${areaKey}:${checked}` })
    dispatch(setShowAreas([...showAreas.filter(({ key }) => key !== areaKey), { key: areaKey, checked }]))
  }

  function handleShowAccessibilities(checked, accessKey) {
    track('filter_change', { filter: 'accessibility', value: `${accessKey}:${checked}` })
    const newAccessibilities = showAccessibilities.map((access) => {
      if (access.key === accessKey) {
        return { ...access, checked }
      }
      return access
    })

    dispatch(setShowAccessibilities(newAccessibilities))
  }

  function getDataStat(prop, value) {
    return dataStats?.[prop]?.[value] || 0
  }

  const accessibilities = /** @type {{ key: string, label: string, description: string }[]} */ (t('accessibility.items', { returnObjects: true }))
  const accesses = /** @type {{ key: string, label: string, description: string }[]} */ (t('access.items', { returnObjects: true }))
  const isSmall = useSmall()

  // The areas the map's caves name, by slug (two spellings are one area),
  // with their count, alphabetically; the caves with none last.
  const areaItems = useMemo(() => {
    const areas = new Map()
    mapData.forEach((cave) => {
      const key = slugify(cave.area) || 'unknown'
      const area = areas.get(key) || { key, name: key === 'unknown' ? null : cave.area, count: 0 }
      area.count++
      areas.set(key, area)
    })
    return [...areas.values()].sort((a, b) => (!a.name ? 1 : !b.name ? -1 : a.name.localeCompare(b.name)))
  }, [mapData])

  // Needs help: how many of the map's caves lack each thing (the map shows
  // only caves with coordinates: not that one); the photos', once the
  // covers are read.
  const missingItems = useMemo(() => {
    const facts = mapData.map((cave) => caveFacts(cave))
    return MISSING_CRITERIA.filter(({ value }) => !MAP_OWN_CRITERIA.includes(value)).map(({ value }) => ({ value, count: value === 'photo' && !covers ? '' : facts.filter((item) => caveMisses(item, value, covers)).length }))
  }, [mapData, covers])

  return (
    <SwipeableDrawer
      className="oc-filter-menu"
      // Closed (it stays in the page, persistent): out of reach of the
      // keyboard and screen readers - its headings came before the page's h1.
      inert={!filterMenuOpen}
      anchor="right"
      hideBackdrop={true}
      variant="persistent"
      slotProps={{
        paper: {
          square: false,
          sx: {
            borderRadius: isSmall ? 'none' : '0.5rem 0 0 0.5rem',
            top: 'var(--oc-filter-menu-top)',
          },
        },
      }}
      sx={{
        '& > .MuiDrawer-paper': {
          width: 'var(--oc-filter-menu-width)',
          maxWidth: '100%',
          height: '100%',
          maxHeight: '100%',
          overflow: 'hidden',
        },
      }}
      open={filterMenuOpen}
      onOpen={handleToggleFilterMenu(true)}
      onClose={handleToggleFilterMenu(false)}
    >
      <FilterMenuHead title={t('windowTitle')} />

      <FilterMenuContent>
        <FilterMenuSectionHeader>{t('coordinate.heading')}</FilterMenuSectionHeader>

        <List disablePadding>
          <FilterMenuItem primary={t('coordinate.showValidCoordinates')} nb={getDataStat('location.validity', 'valid')} onClick={handleShowValidCoordinates} checked={showValidCoordinates} />
          <FilterMenuItem primary={t('coordinate.showInvalidCoordinates')} nb={getDataStat('location.validity', 'invalid')} onClick={handleShowInvalidCoordinates} checked={showInvalidCoordinates} />
          <FilterMenuItem primary={t('coordinate.showUnconfirmedCoordinates')} nb={getDataStat('location.validity', 'unknown')} onClick={handleShowUnconfirmedCoordinates} checked={showUnconfirmedCoordinates} />
        </List>

        <FilterMenuSectionHeader>{t('cenoteType.heading')}</FilterMenuSectionHeader>
        <List disablePadding>
          <FilterMenuItem primary={t('cenoteType.showCenoteEntrances')} nb={getDataStat('cenoteEntrance', true)} onClick={handleShowCenoteEntrances} checked={showCenoteEntrances} />
          <FilterMenuItem primary={t('cenoteType.showOtherCenotes')} nb={getDataStat('cenoteEntrance', false) + getDataStat('cenoteEntrance', 'unknown')} onClick={handleShowOtherCenotes} checked={showOtherCenotes} />
        </List>

        <FilterMenuSectionHeader>{t('needsHelp.heading')}</FilterMenuSectionHeader>
        {/* Unlike the other sections' switches (what's shown), these narrow. */}
        <Typography variant="mapTextSecondary" component="p" sx={{ px: 2, pb: 1 }}>
          {t('needsHelp.hint')}
        </Typography>
        <List disablePadding className="oc-filter-menu--needs-help">
          {missingItems.map(({ value, count }) => (
            <FilterMenuItem key={value} primary={t(`needsHelp.items.${value}`)} nb={count} checked={missing.includes(value)} onClick={() => handleMissing(value)} />
          ))}
        </List>

        <FilterMenuSectionHeader>{t('areas.heading')}</FilterMenuSectionHeader>
        <List disablePadding>
          {areaItems.map(({ key, name, count }) => {
            const checked = !showAreas.some((area) => area.key === key && !area.checked)
            return <FilterMenuItem key={key} primary={name || t('areas.unknown')} nb={count} checked={checked} onClick={() => handleShowAreas(!checked, key)} />
          })}
        </List>

        <FilterMenuSectionHeader>{t('access.heading')}</FilterMenuSectionHeader>
        <List disablePadding>
          {showAccesses.map(({ key, checked }, index) => {
            const primary = accesses.find((a) => a.key === key).label
            const secondary = accesses.find((a) => a.key === key).description
            const nb = getDataStat('access', key)
            const onClick = (e) => handleShowAccesses(!checked, key)
            const k = `access.${key}.${index}`

            return <FilterMenuItem key={k} primary={primary} secondary={secondary} nb={nb} checked={checked} onClick={onClick} />
          })}
        </List>

        <FilterMenuSectionHeader>{t('accessibility.heading')}</FilterMenuSectionHeader>
        <List disablePadding>
          {showAccessibilities.map(({ key, checked }, index) => {
            const primary = accessibilities.find((a) => a.key === key).label
            const secondary = accessibilities.find((a) => a.key === key).description
            const nb = getDataStat('accessibility', key)
            const onClick = () => handleShowAccessibilities(!checked, key)
            const k = `accessibility.${key}.${index}`

            return <FilterMenuItem key={k} primary={primary} secondary={secondary} nb={nb} checked={checked} onClick={onClick} />
          })}
        </List>
      </FilterMenuContent>
    </SwipeableDrawer>
  )
}
