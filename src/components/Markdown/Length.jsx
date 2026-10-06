import { useTranslation } from 'react-i18next'
import { Tooltip } from '@mui/material'
import { useUnits } from '@/hooks/useUnits.jsx'
import { LENGTH_UNITS, parseLength } from './lengthDirective.js'

// A description's `:length[45 m]` tag, shown in the reader's units, as a
// whole number: a length written in the other system shows in its
// counterpart unit (mi -> km, ft -> m...), keeping the written value's
// precision - its significant digits, at least 2: "200 m" is 660 ft, not
// 656 ft; one written with decimals shows rounded ("14.9 m" as 15 m). Either
// way, the value as written is in a tooltip. An unreadable value, or a whole
// one in the reader's system, shows as written.
export default function Length({ text }) {
  const { i18n } = useTranslation()
  const units = useUnits()
  const length = parseLength(text)
  if (!length) return <span className="oc-length">{text}</span>
  const sameSystem = LENGTH_UNITS[length.unit].system === units
  if (sameSystem && !length.written.includes('.')) return <span className="oc-length">{text}</span>
  const unit = sameSystem ? length.unit : LENGTH_UNITS[length.unit].counterpart
  const value = length.metres / LENGTH_UNITS[unit].metres
  const format = sameSystem ? { maximumFractionDigits: 0 } : { maximumSignificantDigits: Math.max(2, length.significantDigits), maximumFractionDigits: 0, roundingPriority: 'lessPrecision' }
  const shown = `${value.toLocaleString(i18n.language, format)} ${unit}`
  return (
    <Tooltip title={text}>
      <span className="oc-length" tabIndex={0} style={{ textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
        {shown}
      </span>
    </Tooltip>
  )
}
