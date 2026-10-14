import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'

/**
 * A yes / no field that can also be unknown (a cave's fees, its
 * facilities): three choices - Unknown, Yes, No - with its label and hint
 * (resultPane.edit.<name>, <name>Hint). Unknown is `null`, saved as no field
 * at all: a switch could only say yes or no, and turned every unknown into
 * "no".
 *
 * @param {object} props
 * @param {string} props.name - Its strings' key.
 * @param {boolean|null} props.value
 * @param {(value: boolean|null) => void} props.onChange
 */
export default function TriStateField({ name, value, onChange }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const labelId = useId()
  const hintId = useId()
  const selected = value === true ? 'yes' : value === false ? 'no' : 'unknown'

  return (
    <Box className={`oc-tri-state-field oc-tri-state-field--${name}`} sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 2, rowGap: 1 }}>
      <Box sx={{ minWidth: 0, flex: '1 1 14rem' }}>
        <Typography id={labelId} variant="body2">{t(name)}</Typography>
        <Typography id={hintId} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {t(`${name}Hint`)}
        </Typography>
      </Box>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={selected}
        // A click on the chosen one keeps it (exclusive groups send null).
        onChange={(_, next) => next && onChange(next === 'yes' ? true : next === 'no' ? false : null)}
        aria-labelledby={labelId}
        aria-describedby={hintId}
        sx={{ flexShrink: 0, '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5, py: 0.25 } }}
      >
        <ToggleButton value="unknown">{t('choiceUnknown')}</ToggleButton>
        <ToggleButton value="yes">{t('choiceYes')}</ToggleButton>
        <ToggleButton value="no">{t('choiceNo')}</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  )
}
