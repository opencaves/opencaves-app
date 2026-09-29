import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, MenuItem, TextField, Typography } from '@mui/material'
import { SUPPORTED_LANGUAGES } from '@/i18n.js'
import { applyLanguage, readDeviceLanguage, saveAccountLanguage } from '@/services/languagePreference.js'

// Each language's name in itself, so it's recognizable whatever the current
// UI language.
const LANGUAGE_NAMES = { en: 'English', fr: 'Français', es: 'Español' }
const AUTOMATIC = 'auto'

// The account page's language setting: a fixed language, or Automatic (the
// browser's). Kept on this device, and in the signed-in account so it follows
// the person (see services/languagePreference.js).
export default function LanguageSection({ headingProps = {} }) {
  const { t, i18n } = useTranslation('account')
  const user = useSelector((state) => state.session.user)
  const [choice, setChoice] = useState(() => readDeviceLanguage() || AUTOMATIC)

  // Also picks up the account's language when it's applied at sign-in.
  useEffect(() => {
    const sync = () => setChoice(readDeviceLanguage() || AUTOMATIC)
    i18n.on('languageChanged', sync)
    return () => i18n.off('languageChanged', sync)
  }, [i18n])

  function handleChange(event) {
    const next = event.target.value
    const code = next === AUTOMATIC ? null : next
    setChoice(next)
    applyLanguage(code)
    if (user?.uid && !user.isAnonymous) {
      saveAccountLanguage(user.uid, code).catch((error) => console.error(error))
    }
  }

  const browserLanguage = (navigator.languages?.[0] || navigator.language || '').slice(0, 2).toLowerCase()
  const automaticLanguage = LANGUAGE_NAMES[browserLanguage] || LANGUAGE_NAMES.en

  return (
    <Box component="section" className="oc-language-section">
      <Typography component="h2" variant="h6" {...headingProps} id="oc-language-section-title">
        {t('language')}
      </Typography>
      <TextField select size="small" fullWidth value={choice} onChange={handleChange} helperText={t('languageHint')} slotProps={{ select: { labelId: 'oc-language-section-title' } }}>
        <MenuItem value={AUTOMATIC}>{t('languageAutomatic', { language: automaticLanguage })}</MenuItem>
        {SUPPORTED_LANGUAGES.map((code) => (
          <MenuItem key={code} value={code} lang={code}>
            {LANGUAGE_NAMES[code]}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  )
}
