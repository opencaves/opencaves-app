import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box } from '@mui/material'
import { TOUCH_TARGET_SX } from '@/components/touchTarget.js'

/**
 * Text-only Privacy · Terms links at the map's bottom-left corner: white with
 * a black outline (like the map's marker labels), readable over any imagery.
 * The white is set on the nav and inherited: a global
 * `a:not(.MuiButtonBase-root) { color: inherit }` rule outranks a color set
 * on the links themselves.
 *
 * Fixed at the bottom-left corner of the map, on every screen size: on
 * phones the result pane's sheet simply covers them while it's open, and on
 * wider screens the result pane (z-index 998) does when one is open there.
 */
export default function MapLegalLinks() {
  const { t } = useTranslation('legal', { keyPrefix: 'links' })

  const linkSx = {
    ...TOUCH_TARGET_SX,
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 24,
    px: 0.5,
    textDecoration: 'none',
    '&:hover, &:focus-visible': { textDecoration: 'underline' },
  }

  return (
    <Box
      component="nav"
      className="oc-map-legal-links"
      aria-label={t('ariaLabel')}
      sx={(theme) => ({
        position: 'absolute',
        left: 8,
        bottom: 8,
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        typography: 'body2',
        // M3 label-medium: a notch under body text, like the map's own attribution.
        fontSize: '0.75rem',
        lineHeight: '1rem',
        fontWeight: 500,
        color: '#fff',
        // An outline all around the glyphs (same technique as the marker
        // labels in Marker.scss).
        textShadow: '#000 1px 0 0, #000 -1px 0 0, #000 0 1px 0, #000 0 -1px 0, #000 1px 1px 0, #000 -1px -1px 0, #000 1px -1px 0, #000 -1px 1px 0',
        [theme.breakpoints.up('sm')]: { left: 12, bottom: 12 },
      })}
    >
      <Box component={Link} to="/privacy" sx={linkSx}>
        {t('privacy')}
      </Box>
      <Box component="span" aria-hidden="true">
        ·
      </Box>
      <Box component={Link} to="/terms" sx={linkSx}>
        {t('terms')}
      </Box>
    </Box>
  )
}
