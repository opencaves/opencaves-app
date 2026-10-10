import { LineCookie } from '@/components/icons.jsx'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map.js'

/**
 * A cave system's colour, as a cave diver's line cookie, beside its name.
 * Text-sized by default. A thin edge keeps a light colour (the default,
 * white) visible on a light page, and a dark one on a dark page.
 */
export default function SistemaCookie({ color, sx }) {
  return (
    <LineCookie
      aria-hidden="true"
      className="oc-sistema-cookie"
      sx={{ fontSize: '1em', flexShrink: 0, verticalAlign: '-0.15em', color: color || SISTEMA_DEFAULT_COLOR, filter: 'drop-shadow(0 0 0.6px var(--oc-sistema-cookie-edge))', ...sx }}
    />
  )
}
