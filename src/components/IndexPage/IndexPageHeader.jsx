import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Breadcrumbs, IconButton, Link as MuiLink, Tooltip, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import EditRounded from '@mui/icons-material/EditRounded'
import AddRounded from '@mui/icons-material/AddRounded'
import PageFab from '@/components/PageFab.jsx'

// An index page's heading row: a back arrow to the page above it (backTo),
// the page's h1 with a line under it (subtitle), and, for editors, a
// floating action button: Add (addTo: a new record's form - the lists) or
// Edit (editTo: the page's /edit address - one area or system). trail: the
// breadcrumbs above it, [{ label, to }] from the landing page down to the
// page's parent; current: the page's own (short) name, ending it.
export default function IndexPageHeader({ title, subtitle, backTo, addTo, addLabel, editTo, editLabel, trail, current }) {
  const { t: tApp } = useTranslation('app')
  const roles = useSelector((state) => state.session.roles)
  // The /edit pages are behind RequireEditor (router.jsx).
  const isEditor = roles.includes('editor')

  const crumbs = trail && (
    <Breadcrumbs className="oc-index-page-header--breadcrumbs" aria-label={tApp('breadcrumbs')} sx={{ mb: 1, typography: 'body2' }}>
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
          <Tooltip title={tApp('back')}>
            <IconButton component={Link} to={backTo} aria-label={tApp('back')} sx={{ ml: { xs: 0, sm: -5 }, mt: { xs: 0, sm: 0.5 } }}>
              <ArrowBackRounded />
            </IconButton>
          </Tooltip>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h1" sx={{ typography: { xs: 'h5', sm: 'h4' }, overflowWrap: 'anywhere' }}>
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
