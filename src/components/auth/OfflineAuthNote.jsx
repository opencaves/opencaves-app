import { useTranslation } from 'react-i18next'
import { Box, Typography } from '@mui/material'
import CloudOffRounded from '@mui/icons-material/CloudOffRounded'
import { useOnline } from '@/hooks/useOnline.jsx'

// Offline, on the sign-in and sign-up screens: they need a connection (their
// buttons are disabled meanwhile - AuthButton). Gone once back online.
export default function OfflineAuthNote({ sx }) {
  const { t } = useTranslation('auth')
  const online = useOnline()
  if (online) return null
  return (
    <Box className="oc-offline-auth-note" role="status" sx={[{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 3, bgcolor: 'var(--mui-sys-color-surfaceContainerHighest)', width: '100%', boxSizing: 'border-box' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <CloudOffRounded sx={{ color: 'text.secondary', flexShrink: 0 }} />
      <Typography variant="body2">{t('offline')}</Typography>
    </Box>
  )
}
