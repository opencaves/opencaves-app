import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box } from '@mui/material'

// Text-only Privacy · Terms links at the map's bottom-left corner: white with
// a black outline (like the map's marker labels), readable over any imagery.
// The white is set on the nav and inherited: a global
// `a:not(.MuiButtonBase-root) { color: inherit }` rule outranks a color set
// on the links themselves.
//
// On phones they ride above the result pane's sheet and fade out once it's
// mostly open (ResultPaneSm's --oc-result-pane-sm-height and
// --oc-map-controls-* variables). On wider screens they stay at the left edge,
// beneath the result pane (z-index 998) when one is open there.
export default function MapLegalLinks() {
  const { t } = useTranslation('legal', { keyPrefix: 'links' })

  const linkSx = {
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
        bottom: 'calc(var(--oc-result-pane-sm-height, 0px) + 8px)',
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
        opacity: 'var(--oc-map-controls-opacity, 1)',
        visibility: 'var(--oc-map-controls-visibility, visible)',
        transition: 'opacity 150ms ease, visibility 150ms ease',
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
