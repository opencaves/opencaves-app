import { useTranslation } from 'react-i18next'
import { Tooltip } from '@mui/material'
import { useUnits } from '@/hooks/useUnits.jsx'
import { LENGTH_UNITS, parseLength } from './lengthDirective.js'

// A description's `:length[45 m]` tag, shown in the reader's units: a length
// written in the other system shows in its counterpart unit (mi -> km,
// ft -> m..., rounded: whole units, or one decimal under 10), with
// the value as written in a tooltip. An unreadable value shows as written.
export default function Length({ text }) {
  const { i18n } = useTranslation()
  const units = useUnits()
  const length = parseLength(text)
  if (!length) return <span className="oc-length">{text}</span>
  if (LENGTH_UNITS[length.unit].system === units) return <span className="oc-length">{text}</span>
  const unit = LENGTH_UNITS[length.unit].counterpart
  const value = length.metres / LENGTH_UNITS[unit].metres
  const shown = `${value.toLocaleString(i18n.language, { maximumFractionDigits: value < 10 ? 1 : 0 })} ${unit}`
  return (
    <Tooltip title={text}>
      <span className="oc-length" tabIndex={0} style={{ textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
        {shown}
      </span>
    </Tooltip>
  )
}
