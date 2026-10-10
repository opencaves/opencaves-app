import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Breadcrumbs, IconButton, Link as MuiLink, Tooltip, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import EditRounded from '@mui/icons-material/EditRounded'
import AddRounded from '@mui/icons-material/AddRounded'
import PageFab from '@/components/PageFab.jsx'
import { PAGE_TITLE_SX } from '@/components/pageTitle.js'

// An index page's heading row: a back arrow to the page above it (backTo),
// the page's h1 with a line under it (subtitle), and, for editors, a
// floating action button: Add (addTo: a new record's form - the lists) or
// Edit (editTo: the page's /edit address - one area or system). trail: the
// breadcrumbs above it, [{ label, to }] from the landing page down to the
// page's parent; current: the page's own (short) name, ending it.
// On one line: the page's own (last) crumb shrinks to fit, ending with an
// ellipsis; the others keep their width, a long one (over 10em) cut too.
const BREADCRUMBS_SX = {
  mb: 3,
  typography: 'body2',
  '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' },
  '& .MuiBreadcrumbs-li': { flexShrink: 0, maxWidth: '10em' },
  '& .MuiBreadcrumbs-li:last-child': { flexShrink: 1, minWidth: '2.5em', maxWidth: 'none' },
  '& .MuiBreadcrumbs-li > *': { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  '& .MuiBreadcrumbs-separator': { flexShrink: 0 },
  // 48 px tall to the touch (their text is 20): padded, the padding taken back.
  '& .MuiBreadcrumbs-li > a': { py: '14px', my: '-14px' },
}

export default function IndexPageHeader({ title, subtitle, backTo, addTo, addLabel, editTo, editLabel, trail, current }) {
  const { t: tApp } = useTranslation('app')
  const navigate = useNavigate()
  const roles = useSelector((/** @type {RootState} */ state) => state.session.roles)
  // The /edit pages are behind RequireEditor (router.jsx).
  const isEditor = roles.includes('editor')

  const crumbs = trail && (
    <Breadcrumbs className="oc-index-page-header--breadcrumbs" aria-label={tApp('breadcrumbs')} sx={BREADCRUMBS_SX}>
      {trail.map(({ label, to }) => (
        <MuiLink key={to} component={Link} to={to} underline="hover" color="inherit">
          {label}
        </MuiLink>
      ))}
      {current && (
        <Typography component="span" variant="body2" aria-current="page" sx={{ color: 'text.primary' }}>
          {current}
        </Typography>
      )}
    </Breadcrumbs>
  )

  return (
    <>
      {crumbs}
      <Box className="oc-index-page-header" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 3 }}>
        {backTo && (
          // As tall as the title's first line (1lh in its typography), the
          // arrow centred on it, whatever the title's size or length.
          <Box sx={{ ...PAGE_TITLE_SX, height: '1lh', display: 'flex', alignItems: 'center', flexShrink: 0, ml: { xs: 0, sm: -4 }, mr: -0.5 }}>
            <Tooltip title={tApp('back')}>
              {/* Opened from within the app: a step back (the list where it was,
                  scrolled as it was); otherwise up to backTo. */}
              <IconButton
                component={Link}
                to={backTo}
                aria-label={tApp('back')}
                onClick={(event) => {
                  if (window.history.state?.idx > 0) {
                    event.preventDefault()
                    navigate(-1)
                  }
                }}
              >
                <ArrowBackRounded />
              </IconButton>
            </Tooltip>
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h1" sx={{ ...PAGE_TITLE_SX, overflowWrap: 'anywhere' }} data-appbar-page-title>
            {title}
          </Typography>
          {subtitle && (
            <Typography component="div" variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {isEditor && addTo && <PageFab className="oc-index-page-header--add" to={addTo} label={addLabel} icon={<AddRounded />} />}
        {isEditor && !addTo && editTo && <PageFab className="oc-index-page-header--edit" to={editTo} label={editLabel} icon={<EditRounded />} />}
      </Box>
    </>
  )
}
