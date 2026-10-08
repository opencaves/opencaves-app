import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Typography } from '@mui/material'
import Markdown from '@/components/Markdown/Markdown.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'
import { PAGE_TITLE_SX } from '@/components/pageTitle.js'

// The Privacy policy and Terms of service pages (/privacy, /terms). Their
// text is Markdown kept in the locale files (legal.<page>.body), so each
// language has its own complete, reviewable document.
export default function LegalPage({ page }) {
  const { t } = useTranslation('legal')
  const { setTitle } = useTitle()

  useEffect(() => {
    setTitle(t(`${page}.title`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, t])

  return (
    <Box
      className={`oc-legal-page oc-legal-page--${page}`}
      component="article"
      sx={{
        width: 'min(100%, 760px)',
        mx: 'auto',
        px: { xs: 2, sm: 3 },
        py: { xs: 3, sm: 5 },
        '& h2': { typography: 'h6', mt: 4, mb: 1 },
        '& p, & li': { typography: 'body1', lineHeight: 1.6 },
        '& ul': { pl: 3 },
        '& a': { color: 'var(--mui-sys-color-primary)' },
      }}
    >
      <Typography component="h1" sx={{ ...PAGE_TITLE_SX, mb: 1 }} data-appbar-page-title>
        {t(`${page}.title`)}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('updated')}
      </Typography>
      <Markdown>{t(`${page}.body`)}</Markdown>
    </Box>
  )
}
