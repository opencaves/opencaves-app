import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Link } from '@mui/material'

// The Privacy and Terms links at the foot of a page (the dashboard's pages,
// Layout and AdminDashboard), in the page's secondary text colour.
export default function LegalLinks({ sx }) {
  const { t } = useTranslation('legal')
  return (
    <Box
      component="nav"
      className="oc-legal-links"
      aria-label={t('links.ariaLabel')}
      sx={[{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 2, rowGap: 1, typography: 'body2', color: 'text.secondary', '& a': { color: 'inherit' } }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      <Link component={RouterLink} to="/privacy" underline="hover">
        {t('links.privacy')}
      </Link>
      <Link component={RouterLink} to="/terms" underline="hover">
        {t('links.terms')}
      </Link>
    </Box>
  )
}
