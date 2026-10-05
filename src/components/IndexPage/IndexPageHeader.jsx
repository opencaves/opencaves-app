import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Fab, IconButton, Tooltip, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import EditRounded from '@mui/icons-material/EditRounded'

// An index page's heading row: a back arrow to the page above it (backTo),
// the page's h1 with a line under it (subtitle), and, for editors, an Edit
// floating action button at the bottom right, to the page's /edit address
// (editTo).
export default function IndexPageHeader({ title, subtitle, backTo, editTo, editLabel }) {
  const { t: tApp } = useTranslation('app')
  const roles = useSelector((state) => state.session.roles)
  // The /edit pages are behind RequireEditor (router.jsx).
  const canEdit = !!editTo && roles.includes('editor')

  return (
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
      {canEdit && (
        <Tooltip title={editLabel} placement="left">
          <Fab className="oc-index-page-header--edit" color="primary" component={Link} to={editTo} aria-label={editLabel} sx={{ position: 'fixed', bottom: (theme) => theme.spacing(3), right: (theme) => theme.spacing(3) }}>
            <EditRounded />
          </Fab>
        </Tooltip>
      )}
    </Box>
  )
}
