import { useEffect } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Alert, Box, Button, Stack, SvgIcon, Typography } from '@mui/material'
import BugReportOutlined from '@mui/icons-material/BugReportOutlined'
import ReportGmailerrorredOutlined from '@mui/icons-material/ReportGmailerrorredOutlined'
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined'
import MapRounded from '@mui/icons-material/MapRounded'
import EditLocationAltOutlined from '@mui/icons-material/EditLocationAltOutlined'
import AddAPhotoOutlined from '@mui/icons-material/AddAPhotoOutlined'
import CloudOffRounded from '@mui/icons-material/CloudOffRounded'
import TranslateRounded from '@mui/icons-material/TranslateRounded'
import DevicesRounded from '@mui/icons-material/DevicesRounded'
import RestartAltRounded from '@mui/icons-material/RestartAltRounded'
import PublicRounded from '@mui/icons-material/PublicRounded'
import FeedbackOutlined from '@mui/icons-material/FeedbackOutlined'
import CaveSystemIcon from '@/images/cave-system.svg?react'
import { useTitle } from '@/hooks/useTitle.jsx'
import { openFeedback } from '@/utils/feedback.js'

// What to report (each opens the form with its kind) and what to try.
const REPORTS = [
  { key: 'bug', icon: <BugReportOutlined /> },
  { key: 'misleading', icon: <ReportGmailerrorredOutlined /> },
  { key: 'idea', icon: <LightbulbOutlined /> },
]
const TRY = [
  { key: 'explore', icon: <MapRounded />, to: '/map' },
  { key: 'edit', icon: <EditLocationAltOutlined />, to: '/caves' },
  { key: 'media', icon: <AddAPhotoOutlined /> },
  { key: 'systems', icon: <SvgIcon component={CaveSystemIcon} inheritViewBox />, to: '/sistemas' },
  { key: 'offline', icon: <CloudOffRounded /> },
  { key: 'everywhere', icon: <DevicesRounded /> },
  { key: 'languages', icon: <TranslateRounded /> },
]
const TIPS = ['one', 'steps', 'page', 'device']

const iconCircle = (theme) => ({ width: 48, height: 48, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: theme.vars.sys.color.secondaryContainer, color: theme.vars.sys.color.primary, '& svg': { fontSize: 26 } })
const cardSx = (theme) => ({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, p: 2.5, borderRadius: 4, height: '100%', bgcolor: theme.vars.palette.background.paper, border: `1px solid ${theme.vars.palette.divider}` })

function SectionTitle({ children, sub }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography component="h2" sx={{ typography: { xs: 'h5', sm: 'h4' }, fontWeight: 500 }}>
        {children}
      </Typography>
      {sub && <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>{sub}</Typography>}
    </Box>
  )
}

const grid = (min) => ({ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2, gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` })

// /what-can-i-do during the beta: what testers can do - report bugs,
// misleading things and ideas (each opening the Send feedback form, its kind
// picked; FeedbackDialog), what to try, how to report well, and what's good to
// know (the beta's data can be reset). The 1.0 page replaces it (branch
// what-can-i-do).
export default function BetaWhatCanIDo() {
  const { t } = useTranslation('betaTesting')
  const { setTitle } = useTitle()
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)

  useEffect(() => {
    setTitle(t('title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  return (
    <Box className="oc-beta-what-can-i-do" component="article" sx={{ width: 'min(100%, 1040px)', mx: 'auto', px: { xs: 0, sm: 1 }, py: { xs: 2, sm: 3 } }}>
      {/* The call, on a band of the primary colour (as the landing page's). */}
      <Box
        component="header"
        sx={(theme) => ({ borderRadius: 4, px: { xs: 3, sm: 6 }, py: { xs: 4, sm: 6 }, mb: { xs: 4, sm: 6 }, color: '#fff', backgroundImage: `linear-gradient(120deg, ${theme.vars.palette.primary.dark}, ${theme.vars.palette.primary.main})` })}
      >
        <Typography variant="overline" sx={{ letterSpacing: '0.12em', opacity: 0.85 }}>
          {t('badge')}
        </Typography>
        <Typography component="h1" sx={{ typography: { xs: 'h4', sm: 'h3' }, fontWeight: 500, mb: 1.5 }} data-appbar-page-title>
          {t('title')}
        </Typography>
        <Typography sx={{ fontSize: { sm: '1.15rem' }, maxWidth: 660, opacity: 0.92, lineHeight: 1.6, mb: 3 }}>{t('lead')}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
          <Button variant="contained" color="secondary" size="large" startIcon={<FeedbackOutlined />} onClick={() => openFeedback()} sx={{ borderRadius: 6 }}>
            {t('sendFeedback')}
          </Button>
          {!isLoggedIn && (
            <Button variant="outlined" component={RouterLink} to="/signup" size="large" sx={{ borderRadius: 6, color: '#fff', borderColor: 'rgba(255,255,255,0.6)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}>
              {t('signup')}
            </Button>
          )}
        </Stack>
      </Box>

      {/* What to report: each card opens the form, its kind picked. */}
      <Box component="section" className="oc-beta-what-can-i-do--report" sx={{ mb: { xs: 5, sm: 7 } }}>
        <SectionTitle sub={t('report.sub')}>{t('report.title')}</SectionTitle>
        <Box component="ul" sx={grid(260)}>
          {REPORTS.map(({ key, icon }) => (
            <li key={key}>
              <Box sx={cardSx}>
                <Box aria-hidden="true" sx={iconCircle}>
                  {icon}
                </Box>
                <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {t(`report.${key}.title`)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, flex: 1 }}>
                  {t(`report.${key}.text`)}
                </Typography>
                <Button variant="outlined" onClick={() => openFeedback(key)} sx={{ borderRadius: 5, mt: 0.5 }}>
                  {t(`report.${key}.action`)}
                </Button>
              </Box>
            </li>
          ))}
        </Box>
      </Box>

      {/* What to try. */}
      <Box component="section" className="oc-beta-what-can-i-do--try" sx={{ mb: { xs: 5, sm: 7 } }}>
        <SectionTitle sub={t('try.sub')}>{t('try.title')}</SectionTitle>
        <Box component="ul" sx={grid(230)}>
          {TRY.map(({ key, icon, to }) => (
            <li key={key}>
              <Box sx={cardSx}>
                <Box aria-hidden="true" sx={iconCircle}>
                  {icon}
                </Box>
                <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {t(`try.${key}.title`)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, flex: 1 }}>
                  {t(`try.${key}.text`)}
                </Typography>
                {to && (
                  <Typography component={RouterLink} to={to} variant="body2" sx={{ color: 'var(--mui-sys-color-primary)', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                    {t(`try.${key}.action`)} →
                  </Typography>
                )}
              </Box>
            </li>
          ))}
        </Box>
      </Box>

      {/* How to report well, and what's good to know. */}
      <Box component="section" className="oc-beta-what-can-i-do--tips" sx={(theme) => ({ borderRadius: 4, p: { xs: 2.5, sm: 4 }, bgcolor: theme.vars.sys.color.surfaceContainer })}>
        <SectionTitle>{t('tips.title')}</SectionTitle>
        <Box component="ol" sx={{ m: 0, mb: 3, pl: 3, '& li': { mb: 1, lineHeight: 1.6 } }}>
          {TIPS.map((key) => (
            <li key={key}>{t(`tips.${key}`)}</li>
          ))}
        </Box>
        <Stack spacing={2} component="ul" sx={{ listStyle: 'none', m: 0, p: 0, mb: 3 }}>
          {[
            { key: 'reset', icon: <RestartAltRounded /> },
            { key: 'public', icon: <PublicRounded /> },
          ].map(({ key, icon }) => (
            <Box component="li" key={key} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box aria-hidden="true" sx={{ color: 'var(--mui-sys-color-primary)', mt: 0.25, '& svg': { fontSize: 26 } }}>
                {icon}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 600 }}>{t(`goodToKnow.${key}.title`)}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                  {t(`goodToKnow.${key}.text`)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
        <Alert severity="warning" variant="outlined" sx={{ borderRadius: 3 }}>
          <Typography sx={{ fontWeight: 600 }}>{t('goodToKnow.safety.title')}</Typography>
          {t('goodToKnow.safety.text')}
        </Alert>
      </Box>
    </Box>
  )
}
