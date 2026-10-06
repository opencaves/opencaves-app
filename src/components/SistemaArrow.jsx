import { LineArrow } from '@/components/icons.jsx'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map.js'

// A cave system's colour, as a cave diver's line arrow, beside its name in
// lists and texts (the system page's title keeps the line cookie,
// SistemaCookie). Text-sized by default, with the cookie's thin edge, which
// keeps a light colour (the default, white) visible on a light page.
export default function SistemaArrow({ color, sx }) {
  return (
    <LineArrow
      aria-hidden="true"
      className="oc-sistema-arrow"
      sx={{ fontSize: '1.15em', flexShrink: 0, verticalAlign: '-0.2em', color: color || SISTEMA_DEFAULT_COLOR, filter: 'drop-shadow(0 0 0.6px var(--oc-sistema-cookie-edge))', ...sx }}
    />
  )
}
