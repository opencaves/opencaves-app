import { useTranslation } from 'react-i18next'
import { Box } from '@mui/material'

/**
 * "Skip to content": the first stop for the keyboard, shown only once it has
 * the focus; it moves the focus past the app bar (10 stops) to the page's
 * main content - the map on the map page, which has no <main>.
 */
export default function SkipLink() {
  const { t } = useTranslation('app')

  function skip(event) {
    const target = document.querySelector('main') || document.querySelector('.mapboxgl-canvas')
    if (!target) return
    event.preventDefault()
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus()
  }

  return (
    <Box
      component="a"
      href="#main"
      className="oc-skip-link"
      onClick={skip}
      sx={(theme) => ({
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: theme.zIndex.tooltip + 1,
        px: 2,
        py: 1.5,
        borderRadius: 2,
        typography: 'body2',
        fontWeight: 600,
        color: theme.vars.palette.primary.contrastText,
        bgcolor: theme.vars.palette.primary.main,
        textDecoration: 'none',
        transform: 'translateY(-200%)',
        '&:focus': { transform: 'none' },
      })}
    >
      {t('skipToContent')}
    </Box>
  )
}
