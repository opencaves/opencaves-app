import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, MenuItem, TextField } from '@mui/material'
import { useColorScheme } from '@mui/material/styles'
import { COLOR_MODES, saveAccountColorMode } from '@/services/colorModePreference.js'

/**
 * The account page's display mode setting: Automatic (the device's light or
 * dark setting), Light or Dark. Kept on this device by MUI, and in the
 * signed-in account so it follows the person (applied at sign-in, ManageAuth).
 */
export default function AppearanceSection() {
  const { t } = useTranslation('account')
  const { mode, setMode } = useColorScheme()
  const user = useSelector((state) => state.session.user)

  function handleChange(event) {
    const next = event.target.value
    setMode(next)
    if (user?.uid && !user.isAnonymous) {
      saveAccountColorMode(user.uid, next).catch((error) => console.error(error))
    }
  }

  // mode is undefined until MUI has read the stored choice.
  if (!mode) return null

  return (
    <Box className="oc-appearance-section">
      <TextField select size="small" label={t('appearance')} value={mode} onChange={handleChange} helperText={t('appearanceHint')} sx={{ width: 340, maxWidth: '100%' }}>
        {COLOR_MODES.map((option) => (
          <MenuItem key={option} value={option}>
            {t(`appearance_${option}`)}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  )
}
