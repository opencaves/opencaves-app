import { useTranslation } from 'react-i18next'
import { Tooltip } from '@mui/material'
import { useUnits } from '@/hooks/useUnits.jsx'
import { fromMetres, lengthUnit } from '@/utils/units.js'
import { parseLength } from './lengthDirective.js'

// A description's `:length[45 m]` tag, shown in the reader's units (rounded
// like the author's value: whole units, or one decimal under 10), with the
// value as written in a tooltip. An unreadable value shows as written.
export default function Length({ text }) {
  const { i18n } = useTranslation()
  const units = useUnits()
  const length = parseLength(text)
  if (!length) return <span className="oc-length">{text}</span>
  const unit = lengthUnit(units)
  if (unit === length.unit) return <span className="oc-length">{text}</span>
  const value = fromMetres(length.metres, units)
  const shown = `${value.toLocaleString(i18n.language, { maximumFractionDigits: value < 10 ? 1 : 0 })} ${unit}`
  return (
    <Tooltip title={text}>
      <span className="oc-length" tabIndex={0} style={{ textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
        {shown}
      </span>
    </Tooltip>
  )
}
