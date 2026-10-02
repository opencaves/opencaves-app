import { useTranslation } from 'react-i18next'
import { Tooltip } from '@mui/material'
import { useUnits } from '@/hooks/useUnits.jsx'
import { LENGTH_UNITS, parseLength } from './lengthDirective.js'

// A description's `:length[45 m]` tag, shown in the reader's units: a length
// written in the other system shows in its counterpart unit (mi -> km,
// ft -> m...), with the value as written in a tooltip. The conversion keeps
// the written value's precision - its significant digits, at least 2 - and
// no more than one decimal under 10, none above: "200 m" is 660 ft, not 656 ft.
// An unreadable value shows as written.
export default function Length({ text }) {
  const { i18n } = useTranslation()
  const units = useUnits()
  const length = parseLength(text)
  if (!length) return <span className="oc-length">{text}</span>
  if (LENGTH_UNITS[length.unit].system === units) return <span className="oc-length">{text}</span>
  const unit = LENGTH_UNITS[length.unit].counterpart
  const value = length.metres / LENGTH_UNITS[unit].metres
  const shown = `${value.toLocaleString(i18n.language, { maximumSignificantDigits: Math.max(2, length.significantDigits), maximumFractionDigits: value < 10 ? 1 : 0, roundingPriority: 'lessPrecision' })} ${unit}`
  return (
    <Tooltip title={text}>
      <span className="oc-length" tabIndex={0} style={{ textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
        {shown}
      </span>
    </Tooltip>
  )
}
