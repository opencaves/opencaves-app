import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Link } from '@mui/material'
import { LanguageButton } from '@/components/LanguagePicker.jsx'
import { TOUCH_TARGET_SX } from '@/components/touchTarget.js'

/**
 * The Privacy and Terms links, and the language, at the foot of a page (the dashboard's pages,
 * Layout and AdminDashboard), in the page's secondary text colour.
 */
export default function LegalLinks({ sx }) {
  const { t } = useTranslation('legal')
  return (
    <Box
      component="nav"
      className="oc-legal-links"
      aria-label={t('links.ariaLabel')}
      sx={[{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: 2, rowGap: 1, typography: 'body2', color: 'text.secondary', '& a': { ...TOUCH_TARGET_SX, color: 'inherit' } }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      <Link component={RouterLink} to="/privacy" underline="hover">
        {t('links.privacy')}
      </Link>
      <Link component={RouterLink} to="/terms" underline="hover">
        {t('links.terms')}
      </Link>
      <LanguageButton />
    </Box>
  )
}
