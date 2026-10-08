import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Alert, AlertTitle, Box, Button, Card, CardActionArea, CardContent, CardMedia, Chip, Grid, InputAdornment, Link, MenuItem, Stack, SvgIcon, TextField, Typography } from '@mui/material'
import MapRounded from '@mui/icons-material/MapRounded'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
import CloudDownloadRounded from '@mui/icons-material/CloudDownloadRounded'
import TimelineRounded from '@mui/icons-material/TimelineRounded'
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded'
import PublicRounded from '@mui/icons-material/PublicRounded'
import TranslateRounded from '@mui/icons-material/TranslateRounded'
import GitHub from '@mui/icons-material/GitHub'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import { useIndexPageHead } from '@/components/IndexPage/useIndexPageHead.js'
import SiteSearch from '@/components/IndexPage/SiteSearch.jsx'
import CaveAsset from '@/models/CaveAsset.js'
import { prefetchMap } from '@/routes/mapRoute.js'
import { APP_LANGUAGES } from '@/config/appLanguages.js'
import { chooseLanguage } from '@/services/languagePreference.js'
import CaveIcon from '@/images/map/cave.svg?react'
import CaveSystemIcon from '@/images/cave-system.svg?react'
// The logo's version for dark backgrounds (the header's photo).
import Logo from '@/images/logo/brand_dark.svg?react'
import heroBackground from '@/images/404/bg.webp'
import { openAboutDialog } from '@/utils/aboutDialog.js'
import './Home.scss'

const GITHUB_URL = 'https://github.com/opencaves/opencaves-app'
const CHANGELOG_URL = 'https://github.com/opencaves/opencaves-app/blob/main/CHANGELOG.md'
// How many cave photos the Discover strip shows, picked at random each visit.
const DISCOVER_COUNT = 6

const caveIcon = (
  <SvgIcon inheritViewBox>
    <CaveIcon />
  </SvgIcon>
)
const sistemaIcon = <SvgIcon component={CaveSystemIcon} inheritViewBox />

// A section's heading and its line under it.
function SectionTitle({ title, subtitle }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography component="h2" sx={{ typography: { xs: 'h5', sm: 'h4' }, fontWeight: 500 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={{ mt: 0.5, color: 'text.secondary' }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  )
}

// An icon in a soft circle of the primary colour (the figures, the cards).
function IconBadge({ children, size = 48 }) {
  return (
    <Box sx={(theme) => ({ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, color: 'primary.main', bgcolor: `rgba(${theme.vars.palette.primary.mainChannel} / 0.1)`, '& svg': { fontSize: size / 2 } })}>
      {children}
    </Box>
  )
}

// The caves' cover photos, in a random order each visit: the first for the
// header's background, the next few for the Discover strip.
function useCoverPhotos() {
  const [photos, setPhotos] = useState([])
  useEffect(() => {
    let cancelled = false
    CaveAsset.getAllCoverImages()
      .then((covers) => {
        if (cancelled) return
        setPhotos([...covers].sort(() => Math.random() - 0.5).slice(0, DISCOVER_COUNT + 1))
      })
      .catch((error) => console.error(error))
    return () => {
      cancelled = true
    }
  }, [])
  return photos
}

// The language of the page - and, signed in, of the account's preference.
function LanguageMenu() {
  const { t, i18n } = useTranslation('home')
  const user = useSelector((state) => state.session.user)
  const current = APP_LANGUAGES.some(({ code }) => code === i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en'
  return (
    <TextField
      select
      size="small"
      className="oc-home--language"
      // No field background: a plain choice in the footer.
      variant="standard"
      value={current}
      onChange={(event) => chooseLanguage(event.target.value, user)}
      sx={{ minWidth: 180 }}
      slotProps={{ input: { disableUnderline: true, startAdornment: <InputAdornment position="start"><TranslateRounded fontSize="small" /></InputAdornment> }, select: { inputProps: { 'aria-label': t('footer.language') }, SelectDisplayProps: { 'aria-label': t('footer.language') } } }}
    >
      {APP_LANGUAGES.map(({ code, nativeName }) => (
        <MenuItem key={code} value={code} lang={code}>
          {nativeName}
        </MenuItem>
      ))}
    </TextField>
  )
}

// / - the landing page, for cave divers around the world: what OpenCaves is
// (a cave search, the map), some of its caves, its figures, the safety
// warning and the disclaimer (up front, not in the fine print), what's in
// it, its regions, how to contribute, and the language.
export default function Home() {
  const { t } = useTranslation('home')
  const { t: tAbout } = useTranslation('about')
  const { t: tLegal } = useTranslation('legal')
  const { t: tIndex } = useTranslation('indexPages')
  const { data } = useIndexData()
  const [heroPhoto, ...photos] = useCoverPhotos()
  const regions = data.areas.filter((area) => area.caves.length > 0)

  useIndexPageHead({ title: t('title'), description: t('description') })

  // The map's code, fetched once the page has painted: most visitors go on
  // to the map, which then opens without waiting for it.
  useEffect(() => prefetchMap(), [])

  const caveName = (caveId) => {
    const cave = data.caves.find(({ id }) => id === caveId)
    return { name: cave?.name || tIndex('unnamedCave'), sistema: data.sistemasById.get(cave?.sistemaId)?.name }
  }

  const features = [
    { key: 'caves', icon: caveIcon, to: '/caves' },
    { key: 'sistemas', icon: sistemaIcon, to: '/sistemas' },
    { key: 'maps', icon: <TimelineRounded />, to: '/map' },
    { key: 'offline', icon: <CloudDownloadRounded />, to: '/map' },
  ]

  return (
    <Box className="oc-home" sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 6, sm: 8 }, pb: 2 }}>
      {/* The header: a cave's photo, at random (the site's own cave photo
          until it loads), darkened for the text; the logo, a cave search and
          the map. */}
      <Box
        className="oc-home--hero"
        sx={{
          position: 'relative',
          borderRadius: 3,
          overflow: 'hidden',
          color: '#fff',
          backgroundImage: `linear-gradient(110deg, rgba(4, 22, 32, 0.92) 0%, rgba(4, 22, 32, 0.7) 45%, rgba(4, 22, 32, 0.25) 100%), ${heroPhoto ? `url(${heroPhoto.getThumbnailUrl('1536')}), ` : ''}url(${heroBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          px: { xs: 3, sm: 6, md: 8 },
          py: { xs: 6, sm: 9, md: 11 },
        }}
      >
        <Box sx={{ width: { xs: 140, sm: 180 }, mb: 3, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))', '& svg': { display: 'block', width: '100%', height: 'auto' } }} aria-hidden="true">
          <Logo />
        </Box>
        <Typography component="h1" sx={{ typography: { xs: 'h4', sm: 'h3', md: 'h2' }, fontWeight: { xs: 500, md: 500 }, mb: 2, maxWidth: 760, textWrap: 'balance' }}>
          {t('hero.title')}
        </Typography>
        <Typography sx={{ typography: { xs: 'body1', sm: 'h6' }, fontWeight: { sm: 400 }, mb: 4, maxWidth: 640, opacity: 0.92, lineHeight: { sm: 1.6 } }}>
          {t('hero.lead')}
        </Typography>
        <SiteSearch
          sx={{ maxWidth: 560, mb: 3 }}
          inputSx={(theme) => ({ '& .MuiOutlinedInput-root': { borderRadius: theme.shape.borderRadius * 6, bgcolor: theme.vars.palette.background.paper, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }, '& fieldset': { border: 0 } })}
        />
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          {/* The page's main call: larger, in the brand's gold, with a glow;
              its arrow moves forward and the button lifts on hover. */}
          <Button
            className="oc-home--map"
            variant="contained"
            color="secondary"
            size="large"
            component={RouterLink}
            to="/map"
            startIcon={<MapRounded />}
            endIcon={<ArrowForwardRounded className="oc-home--map-arrow" />}
            sx={(theme) => ({
              borderRadius: 8,
              px: 3.5,
              py: 1.5,
              fontSize: '1.05rem',
              fontWeight: 600,
              boxShadow: `0 6px 24px rgba(${theme.vars.palette.secondary.mainChannel} / 0.45)`,
              transition: 'transform 200ms ease, box-shadow 200ms ease',
              '& .oc-home--map-arrow': { transition: 'transform 200ms ease' },
              '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 10px 30px rgba(${theme.vars.palette.secondary.mainChannel} / 0.6)` },
              '&:hover .oc-home--map-arrow': { transform: 'translateX(4px)' },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' }, '&:hover .oc-home--map-arrow': { transform: 'none' } },
            })}
          >
            {t('hero.openMap')}
          </Button>
          {/* The two directories: text buttons, without a border, beside the main call. */}
          {[
            ['caves', '/caves', caveIcon],
            ['sistemas', '/sistemas', sistemaIcon],
          ].map(([key, to, icon]) => (
            <Button key={key} className={`oc-home--browse-${key}`} variant="text" size="large" component={RouterLink} to={to} startIcon={icon} sx={{ borderRadius: 6, px: 2, color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
              {t(`hero.browse.${key}`)}
            </Button>
          ))}
        </Stack>
      </Box>

      {/* The figures, live from the data. */}
      {data.caves.length > 0 && (
        <Grid container spacing={2} className="oc-home--figures" component="section" aria-label={t('figures.label')}>
          {[
            ['caves', data.caves.length, '/caves', caveIcon],
            ['sistemas', data.sistemas.length, '/sistemas', sistemaIcon],
          ].map(([key, count, to, icon]) => (
            <Grid key={key} size={{ xs: 12, sm: 6 }}>
              <Card variant="outlined" sx={{ height: '100%', borderRadius: 3 }}>
                <CardActionArea component={RouterLink} to={to} sx={{ height: '100%', p: 2.5, display: 'flex', gap: 2, justifyContent: 'flex-start' }}>
                  <IconBadge size={56}>{icon}</IconBadge>
                  <Box>
                    <Typography sx={{ typography: 'h4', color: 'var(--mui-sys-color-primary)', fontWeight: 600, lineHeight: 1.1 }}>{count.toLocaleString()}</Typography>
                    <Typography sx={{ color: 'text.secondary' }}>{t(`figures.${key}`, { count })}</Typography>
                  </Box>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Up front, not in the fine print: the danger of cave diving, and the
          data's limits (the terms' "Safety first" says the same). */}
      <Box className="oc-home--warnings" component="section" aria-label={t('warningsLabel')} sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Alert severity="error" icon={<WarningAmberRounded fontSize="inherit" />} sx={{ borderRadius: 3, alignItems: 'flex-start', '& .MuiAlert-icon': { fontSize: 28 } }}>
          <AlertTitle sx={{ fontWeight: 600 }}>{t('safety.title')}</AlertTitle>
          {t('safety.text')}
          {/* Where cavern diving ends and cave diving begins. */}
          <Box component="p" sx={{ mt: 1, mb: 0 }}>
            {t('safety.cavern')}
          </Box>
        </Alert>
        <Alert severity="warning" sx={{ borderRadius: 3, alignItems: 'flex-start', '& .MuiAlert-icon': { fontSize: 28 } }}>
          <AlertTitle sx={{ fontWeight: 600 }}>{t('disclaimer.title')}</AlertTitle>
          {t('disclaimer.text')}{' '}
          <Link component={RouterLink} to="/terms" color="inherit" sx={{ fontWeight: 500 }}>
            {tLegal('terms.title')}
          </Link>
          .
        </Alert>
      </Box>

      {/* Some of the caves, with their photos. */}
      {photos.length > 0 && (
        <Box component="section" className="oc-home--discover">
          <SectionTitle title={t('discover.title')} subtitle={t('discover.subtitle')} />
          <Grid container spacing={2}>
            {photos.map((photo) => {
              const { name, sistema } = caveName(photo.caveId)
              return (
                <Grid key={photo.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card sx={{ borderRadius: 3, height: '100%', transition: 'transform 200ms ease, box-shadow 200ms ease', '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 } }}>
                    <CardActionArea component={RouterLink} to={`/caves/${photo.caveId}`} sx={{ height: '100%' }}>
                      <CardMedia component="img" image={photo.getThumbnailUrl('coverImage')} alt={name} loading="lazy" crossOrigin="anonymous" sx={{ aspectRatio: '16 / 9', objectFit: 'cover' }} />
                      <CardContent>
                        <Typography component="h3" variant="h6" sx={{ lineHeight: 1.3 }}>
                          {name}
                        </Typography>
                        {sistema && (
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {tIndex('sistema.title', { name: sistema })}
                          </Typography>
                        )}
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
          <Button component={RouterLink} to="/caves" sx={{ mt: 2 }}>
            {t('discover.all')}
          </Button>
        </Box>
      )}

      <Box component="section" className="oc-home--features">
        <SectionTitle title={t('features.title')} subtitle={t('features.subtitle')} />
        <Grid container spacing={2}>
          {features.map(({ key, icon, to }) => (
            <Grid key={key} size={{ xs: 12, sm: 6, md: 3 }}>
              <Card variant="outlined" sx={{ height: '100%', borderRadius: 3, transition: 'box-shadow 200ms ease, border-color 200ms ease', '&:hover': { boxShadow: 4, borderColor: 'transparent' } }}>
                <CardActionArea component={RouterLink} to={to} sx={{ height: '100%', alignItems: 'flex-start' }}>
                  <CardContent>
                    <IconBadge>{icon}</IconBadge>
                    <Typography component="h3" variant="h6" sx={{ mt: 2, mb: 1 }}>
                      {t(`features.${key}.title`)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                      {t(`features.${key}.text`)}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {regions.length > 0 && (
        <Box component="section" className="oc-home--regions" id="regions">
          <SectionTitle title={t('regions.title')} subtitle={t('regions.yucatan')} />
          <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {regions.map((area) => (
              <li key={area.slug}>
                <Chip component={RouterLink} to={`/caves#${area.slug}`} clickable variant="outlined" label={`${area.name} · ${area.caves.length}`} sx={{ fontSize: 15, py: 2.25, px: 0.5, borderRadius: 4 }} />
              </li>
            ))}
          </Box>
          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            {t('regions.more')}
          </Typography>
        </Box>
      )}

      {/* How to contribute, on a band of the primary colour. */}
      <Box
        component="section"
        className="oc-home--contribute"
        sx={(theme) => ({ borderRadius: 3, px: { xs: 3, sm: 6 }, py: { xs: 4, sm: 6 }, color: '#fff', backgroundImage: `linear-gradient(120deg, ${theme.vars.palette.primary.dark}, ${theme.vars.palette.primary.main})` })}
      >
        <Typography component="h2" sx={{ typography: { xs: 'h5', sm: 'h4' }, fontWeight: 500, mb: 1.5 }}>
          {t('contribute.title')}
        </Typography>
        <Typography sx={{ mb: 3, maxWidth: 680, opacity: 0.92, lineHeight: 1.7 }}>{t('contribute.text')}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
          <Button variant="contained" color="secondary" component={RouterLink} to="/signup" size="large" sx={{ borderRadius: 6 }}>
            {t('contribute.signup')}
          </Button>
          <Button variant="outlined" href={GITHUB_URL} target="_blank" rel="noopener noreferrer" startIcon={<GitHub />} size="large" sx={{ borderRadius: 6, color: '#fff', borderColor: 'rgba(255,255,255,0.6)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}>
            {t('contribute.github')}
          </Button>
        </Stack>
      </Box>

      {/* The footer: the site's pages, and the language. */}
      <Box className="oc-home--footer" component="footer" sx={{ pt: 3, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="nav" aria-label={tLegal('links.ariaLabel')} variant="body2" sx={{ color: 'text.secondary', display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 1 }}>
          <Link component={RouterLink} to="/about" onClick={openAboutDialog}>
            {t('footer.about')}
          </Link>
          <Link component={RouterLink} to="/privacy">{tLegal('privacy.title')}</Link>
          <Link component={RouterLink} to="/terms">{tLegal('terms.title')}</Link>
          <Link href={CHANGELOG_URL} target="_blank" rel="noopener noreferrer">{tAbout('whatsNew')}</Link>
        </Typography>
        <LanguageMenu />
      </Box>
    </Box>
  )
}
