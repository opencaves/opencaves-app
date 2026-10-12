import { useEffect } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Alert, Box, Button, ButtonBase, Stack, SvgIcon, Typography } from '@mui/material'
import { LineArrow } from '@/components/icons.jsx'
import MapRounded from '@mui/icons-material/MapRounded'
import MenuBookRounded from '@mui/icons-material/MenuBookRounded'
import DirectionsRounded from '@mui/icons-material/DirectionsRounded'
import NewReleasesRounded from '@mui/icons-material/NewReleasesRounded'
import EditLocationAltRounded from '@mui/icons-material/EditLocationAltRounded'
import FactCheckRounded from '@mui/icons-material/FactCheckRounded'
import RouteRounded from '@mui/icons-material/RouteRounded'
import MyLocationRounded from '@mui/icons-material/MyLocationRounded'
import EditNoteRounded from '@mui/icons-material/EditNoteRounded'
import AddAPhotoRounded from '@mui/icons-material/AddAPhotoRounded'
import VideoLibraryRounded from '@mui/icons-material/VideoLibraryRounded'
import PublicRounded from '@mui/icons-material/PublicRounded'
import HistoryRounded from '@mui/icons-material/HistoryRounded'
import AdminPanelSettingsRounded from '@mui/icons-material/AdminPanelSettingsRounded'
import FeedbackRounded from '@mui/icons-material/FeedbackRounded'
import CaveSystemIcon from '@/images/cave-system.svg?react'
import { useTitle } from '@/hooks/useTitle.jsx'
import { openFeedback } from '@/utils/feedback.js'
import { PAGE_TITLE_SX } from '@/components/pageTitle.js'

// Each card's icon and, for some, where it leads (to) or what it does
// (onClick) (its text, title and action label in the locale files:
// whatCanIDo.<group>.<key>).
const EXPLORE = [
  { key: 'find', icon: <MapRounded />, to: '/map' },
  { key: 'read', icon: <MenuBookRounded />, to: '/caves' },
  { key: 'directions', icon: <DirectionsRounded /> },
  { key: 'whatsNew', icon: <NewReleasesRounded />, to: '/whats-new' },
]
const CONTRIBUTE = [
  // Reviewing what's there (it ages): a report to the team (FeedbackDialog) -
  // or an edit, said in its text.
  { key: 'checkWhatsThere', icon: <FactCheckRounded />, onClick: () => openFeedback() },
  // Filling or confirming: each leads to the caves concerned (caveFilters.js).
  { key: 'checkFacts', icon: <MyLocationRounded />, to: '/caves?missing=position' },
  { key: 'passages', icon: <RouteRounded />, onClick: () => openFeedback() },
  { key: 'coordinates', icon: <EditLocationAltRounded />, to: '/caves?missing=coordinates' },
  { key: 'media', icon: <AddAPhotoRounded />, to: '/caves?missing=photo' },
  { key: 'videos', icon: <VideoLibraryRounded />, to: '/caves?missing=video' },
  { key: 'texts', icon: <EditNoteRounded />, to: '/caves?missing=description' },
  { key: 'directions', icon: <DirectionsRounded />, to: '/caves?missing=directions' },
  { key: 'attach', icon: <SvgIcon component={CaveSystemIcon} inheritViewBox />, to: '/caves?missing=system' },
]
const GOOD_TO_KNOW = [
  { key: 'public', icon: <PublicRounded /> },
  { key: 'mistakes', icon: <HistoryRounded /> },
  { key: 'admins', icon: <AdminPanelSettingsRounded /> },
  // The Send feedback form (FeedbackDialog: sign-in first for visitors), its
  // action under its text.
  { key: 'feedback', icon: <FeedbackRounded />, onClick: () => openFeedback() },
]

// One thing to do: its icon in a tonal circle, a title and a line; a card
// that leads somewhere is a link, one that does something a button (its
// action said at its foot).
function ActionCard({ group, item }) {
  const { t } = useTranslation('whatCanIDo')
  const actionable = Boolean(item.to || item.onClick)
  const link = item.to ? { component: RouterLink, to: item.to } : item.onClick ? { component: 'button', type: 'button', onClick: item.onClick } : { component: 'div', disableRipple: true, tabIndex: -1 }
  return (
    <ButtonBase
      {...link}
      className="oc-what-can-i-do--card"
      sx={(theme) => ({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        textAlign: 'left',
        gap: 1,
        p: 2.5,
        borderRadius: 4,
        height: '100%',
        bgcolor: theme.vars.palette.background.paper,
        border: `1px solid ${theme.vars.palette.divider}`,
        color: 'text.primary',
        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
        cursor: actionable ? 'pointer' : 'default',
        ...(actionable && {
          '&:hover, &.Mui-focusVisible': { transform: 'translateY(-2px)', boxShadow: 3, borderColor: theme.vars.sys.color.primary },
        }),
        '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
      })}
    >
      <Box
        aria-hidden="true"
        sx={(theme) => ({
          width: 48,
          height: 48,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          bgcolor: theme.vars.sys.color.secondaryContainer,
          color: theme.vars.sys.color.primary,
          '& svg': { fontSize: 26 },
        })}
      >
        {item.icon}
      </Box>
      <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
        {t(`${group}.${item.key}.title`)}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, flex: 1 }}>
        {t(`${group}.${item.key}.text`)}
      </Typography>
      {actionable && (
        <Typography variant="body2" sx={(theme) => ({ color: theme.vars.sys.color.primary, fontWeight: 600 })}>
          {t(`${group}.${item.key}.action`)} →
        </Typography>
      )}
    </ButtonBase>
  )
}

// min: a card's narrowest width - wider for the Contribute cards, three to a
// row on a computer.
function CardGrid({ group, items, min = 230 }) {
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2, gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}>
      {items.map((item) => (
        <li key={item.key}>
          <ActionCard group={group} item={item} />
        </li>
      ))}
    </Box>
  )
}

/**
 * A section's heading, a cave diver's line arrow before it (decorative,
 * {@link LineArrow}), with a line under it, in line with the heading's text.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {import('react').ReactNode} [props.sub] - The line under it.
 */
function SectionTitle({ children, sub }) {
  return (
    <Box className="oc-what-can-i-do--section-title" sx={{ mb: 2.5, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.5, alignItems: 'center' }}>
      {/* In the secondary colour, pointing the reading way: flipped right to left. */}
      <LineArrow aria-hidden="true" sx={{ color: 'secondary.main', fontSize: { xs: '1.75rem', sm: '2.125rem' }, '[dir="rtl"] &': { transform: 'scaleX(-1)' } }} />
      <Typography component="h2" sx={{ typography: { xs: 'h5', sm: 'h4' }, fontWeight: 500 }}>
        {children}
      </Typography>
      {sub && <Typography sx={{ gridColumn: 2, color: 'text.secondary', mt: 0.5 }}>{sub}</Typography>}
    </Box>
  )
}

/**
 * /what-can-i-do: what OpenCaves' users can do - explore, then, signed up,
 * add and correct caves and their photos, videos and maps, check their facts
 * - as cards under a hero band, then what's good to know, sending feedback
 * among it (FeedbackDialog). Visitors who aren't signed in are invited to
 * sign up.
 */
export default function WhatCanIDo() {
  const { t } = useTranslation('whatCanIDo')
  const { setTitle } = useTitle()
  const isLoggedIn = useSelector((/** @type {RootState} */ state) => state.session.isLoggedIn)

  useEffect(() => {
    setTitle(t('title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  return (
    <Box className="oc-what-can-i-do" component="article" sx={{ width: 'min(100%, 1040px)', mx: 'auto', px: { xs: 0, sm: 1 }, py: { xs: 2, sm: 3 } }}>
      {/* The promise, on a band of the primary colour (as the landing page's). */}
      <Box
        component="header"
        sx={(theme) => ({ borderRadius: 4, px: { xs: 3, sm: 6 }, py: { xs: 4, sm: 6 }, mb: { xs: 4, sm: 6 }, color: '#fff', backgroundImage: `linear-gradient(120deg, ${theme.vars.palette.primary.dark}, ${theme.vars.palette.primary.main})` })}
      >
        <Typography component="h1" sx={{ ...PAGE_TITLE_SX, mb: 1.5 }} data-appbar-page-title>
          {t('title')}
        </Typography>
        <Typography sx={{ fontSize: { sm: '1.15rem' }, maxWidth: 640, opacity: 0.92, lineHeight: 1.6, mb: 3 }}>{t('lead')}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
          {isLoggedIn ? (
            <Button variant="contained" color="secondary" component={RouterLink} to="/map" size="large" startIcon={<MapRounded />} sx={{ borderRadius: 6 }}>
              {t('openMap')}
            </Button>
          ) : (
            <>
              <Button variant="contained" color="secondary" component={RouterLink} to="/signup" size="large" sx={{ borderRadius: 6 }}>
                {t('signup')}
              </Button>
              <Button variant="outlined" component={RouterLink} to="/map" size="large" sx={{ borderRadius: 6, color: '#fff', borderColor: 'rgba(255,255,255,0.6)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}>
                {t('openMap')}
              </Button>
            </>
          )}
        </Stack>
      </Box>

      <Box component="section" className="oc-what-can-i-do--explore" sx={{ mb: { xs: 5, sm: 7 } }}>
        <SectionTitle sub={t('explore.sub')}>{t('explore.title')}</SectionTitle>
        <CardGrid group="explore" items={EXPLORE} />
      </Box>

      <Box component="section" className="oc-what-can-i-do--contribute" sx={{ mb: { xs: 5, sm: 7 } }}>
        <SectionTitle sub={t('contribute.sub')}>{t('contribute.title')}</SectionTitle>
        <CardGrid group="contribute" items={CONTRIBUTE} min={290} />
      </Box>

      <Box component="section" className="oc-what-can-i-do--good-to-know" sx={(theme) => ({ borderRadius: 4, p: { xs: 2.5, sm: 4 }, bgcolor: theme.vars.sys.color.surfaceContainer })}>
        <SectionTitle>{t('goodToKnow.title')}</SectionTitle>
        <Stack spacing={2} component="ul" sx={{ listStyle: 'none', m: 0, p: 0, mb: 3 }}>
          {GOOD_TO_KNOW.map(({ key, icon, onClick }) => (
            <Box component="li" key={key} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box aria-hidden="true" sx={(theme) => ({ color: theme.vars.sys.color.primary, mt: 0.25, '& svg': { fontSize: 26 } })}>
                {icon}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 600 }}>{t(`goodToKnow.${key}.title`)}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                  {t(`goodToKnow.${key}.text`)}
                </Typography>
                {onClick && (
                  <Button size="small" onClick={onClick} className="oc-what-can-i-do--good-to-know-action" sx={{ mt: 0.5, ml: -1, textTransform: 'none', fontWeight: 600 }}>
                    {t(`goodToKnow.${key}.action`)} →
                  </Button>
                )}
              </Box>
            </Box>
          ))}
        </Stack>
        {/* The one thing never to forget. */}
        <Alert severity="warning" variant="outlined" sx={{ borderRadius: 3 }}>
          <Typography sx={{ fontWeight: 600 }}>{t('goodToKnow.safety.title')}</Typography>
          {t('goodToKnow.safety.text')}
        </Alert>
      </Box>
    </Box>
  )
}
