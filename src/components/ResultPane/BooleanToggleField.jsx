import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Switch, Typography } from '@mui/material'
import { useSmall } from '@/hooks/useSmall.jsx'

export default function BooleanToggleField({ name, value, onChange }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const hintId = useId()
  // Standard size on phones for a comfortable touch target.
  const isSmall = useSmall()

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <Switch size={isSmall ? 'medium' : 'small'} checked={value} onChange={(_, checked) => onChange(checked)} slotProps={{ input: { 'aria-label': t(name), 'aria-describedby': hintId } }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2">{t(name)}</Typography>
        <Typography id={hintId} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {t(`${name}Hint`)}
        </Typography>
      </Box>
    </Box>
  )
}
