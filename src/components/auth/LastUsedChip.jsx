import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box } from '@mui/material'
import { lastSignInMethod } from '@/utils/lastSignInMethod.js'

/**
 * "Last used", on the top edge of a sign-in button, when it's the way this
 * device last signed in ({@link lastSignInMethod}) - read once mounted (the
 * browser's storage).
 *
 * @param {object} props
 * @param {string} props.method - The button's method: a provider's id, or 'email'.
 */
export default function LastUsedChip({ method }) {
  const { t } = useTranslation('auth', { keyPrefix: 'login' })
  const [last, setLast] = useState(null)
  useEffect(() => setLast(lastSignInMethod()), [])

  if (last !== method) return null
  return (
    <Box
      component="span"
      className="oc-last-used-chip"
      sx={(theme) => ({
        position: 'absolute',
        top: -10,
        right: 16,
        px: 1,
        py: '2px',
        borderRadius: 2,
        // M3's label medium, on the secondary container (M3's tonal chip).
        fontSize: '0.75rem',
        lineHeight: '1rem',
        fontWeight: 500,
        letterSpacing: '0.03125rem',
        textTransform: 'none',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        bgcolor: theme.vars.sys.color.secondaryContainer,
        color: theme.vars.sys.color.onSecondaryContainer,
      })}
    >
      {t('lastUsed')}
    </Box>
  )
}
