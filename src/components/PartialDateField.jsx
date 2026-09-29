import { TextField } from '@mui/material'
import { useTranslation } from 'react-i18next'

// Dates here only need to be as precise as what's actually known - a year, a
// year and month, or a full day (plus, where allowed, a year range) - so this
// is a plain text field rather than a date picker (which forces day-level
// precision and can't represent "2019" or "2019-06" on their own).
const PARTIAL_DATE_PATTERN = /^\d{4}(-\d{2}(-\d{2})?)?$/
const PARTIAL_DATE_OR_RANGE_PATTERN = /^\d{4}(-(\d{2}(-\d{2})?|\d{4}))?$/

// Blank counts as valid: these dates are always optional.
export function isValidPartialDate(value, { allowRange = true } = {}) {
  return !value || (allowRange ? PARTIAL_DATE_OR_RANGE_PATTERN : PARTIAL_DATE_PATTERN).test(value)
}

// description: what the date is (e.g. when a connection was established),
// shown in the hint before the accepted precisions.
export default function PartialDateField({ value, allowRange = true, description, className, ...props }) {
  const { t } = useTranslation('partialDateField')
  const invalid = !isValidPartialDate(value, { allowRange })
  const formats = t(allowRange ? 'formatsWithRange' : 'formats')

  // The hint says what the date is and how precise it can be; once the value
  // doesn't match, it turns into the error message (error color).
  const helperText = invalid ? t('invalid', { formats }) : [description, t('hint', { formats })].filter(Boolean).join(' ')
  return <TextField className={['oc-partial-date-field', className].filter(Boolean).join(' ')} value={value} error={invalid} helperText={helperText} {...props} />
}
