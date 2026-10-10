import { TextField } from '@mui/material'
import { useTranslation } from 'react-i18next'

// Dates here only need to be as precise as what's actually known - a year, a
// year and month, or a full day (plus, where allowed, a year range) - so this
// is a plain text field rather than a date picker (which forces day-level
// precision and can't represent "2019" or "2019-06" on their own).
const PARTIAL_DATE_PATTERN = /^\d{4}(-\d{2}(-\d{2})?)?$/
const PARTIAL_DATE_OR_RANGE_PATTERN = /^\d{4}(-(\d{2}(-\d{2})?|\d{4}))?$/

// Blank counts as valid: these dates are always optional.
// A real date too, not only its shape: a month 01-12, a day its month has
// (2014-13 and 2019-02-30 were accepted), and a range that runs forward.
function isRealDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  if (month === undefined) return true
  if (month < 1 || month > 12) return false
  if (day === undefined) return true
  return day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function isValidPartialDate(value, { allowRange = true } = {}) {
  if (!value) return true
  if (!(allowRange ? PARTIAL_DATE_OR_RANGE_PATTERN : PARTIAL_DATE_PATTERN).test(value)) return false
  // A range of years: 2019-2021.
  const range = value.match(/^(\d{4})-(\d{4})$/)
  if (range) return Number(range[1]) <= Number(range[2])
  return isRealDate(value)
}

/**
 * As wide as its widest value (a full date, 2019-06-15 - wider than a range,
 * 2019-2021) or its label, whichever is longer; its hint may run wider.
 *
 * @param {object} props
 * @param {string} [props.description] - What the date is (e.g. when a connection was established),
 *   shown in the hint before the accepted precisions.
 */
export default function PartialDateField({ value, allowRange = true, description, className, sx, label, ...props }) {
  const { t } = useTranslation('partialDateField')
  const invalid = !isValidPartialDate(value, { allowRange })
  const formats = t(allowRange ? 'formatsWithRange' : 'formats')

  // The hint says what the date is and how precise it can be; once the value
  // doesn't match, it turns into the error message (error color).
  const helperText = invalid ? t('invalid', { formats }) : [description, t('hint', { formats })].filter(Boolean).join(' ')
  const chars = Math.max(10, String(label || '').length)
  const widthSx = { width: `calc(${chars}ch + 32px)`, maxWidth: '100%', '& .MuiFormHelperText-root': { width: 'max-content', maxWidth: 'min(720px, calc(100vw - 96px))' } }
  return <TextField className={['oc-partial-date-field', className].filter(Boolean).join(' ')} label={label} value={value} error={invalid} helperText={helperText} {...props} sx={[widthSx, ...(Array.isArray(sx) ? sx : [sx])]} />
}
