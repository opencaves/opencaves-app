import { useTranslation } from 'react-i18next'
import { Box, Switch, Typography } from '@mui/material'

/**
 * A switch with its current answer, "Yes" or "No", written at its left -
 * always in the same place: the word's box is as wide as the longer of the
 * two, so the switch doesn't move as it flips. A click on the word flips it
 * too. The word is for the eye: the switch itself has the accessible name
 * and state.
 *
 * @param {import('@mui/material/Switch').SwitchProps & { checked: boolean, onChange?: (event: import('react').SyntheticEvent, checked: boolean) => void }} props - The
 *   Switch's.
 */
export default function YesNoSwitch({ checked, disabled, onChange, className, ...switchProps }) {
  const { t } = useTranslation('yesNoSwitch')

  return (
    <Box className="oc-yes-no-switch" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flex: 'none' }}>
      <Typography
        component="span"
        aria-hidden="true"
        className="oc-yes-no-switch--value"
        // Inside a <label>, the label would flip it too: once is enough.
        onClick={(event) => {
          event.preventDefault()
          if (!disabled) onChange?.(event, !checked)
        }}
        sx={{
          // Both words in one cell, the other one hidden: the width of the longer.
          display: 'inline-grid',
          justifyItems: 'end',
          '& > *': { gridArea: '1 / 1' },
          cursor: disabled ? 'default' : 'pointer',
          userSelect: 'none',
          color: disabled ? 'text.disabled' : 'text.primary',
        }}
      >
        <span style={{ visibility: checked ? 'visible' : 'hidden' }}>{t('yes')}</span>
        <span style={{ visibility: checked ? 'hidden' : 'visible' }}>{t('no')}</span>
      </Typography>
      <Switch className={className} checked={checked} disabled={disabled} onChange={onChange} {...switchProps} />
    </Box>
  )
}
