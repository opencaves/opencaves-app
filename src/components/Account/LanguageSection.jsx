import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, MenuItem, TextField, Typography } from '@mui/material'
import { APP_LANGUAGES } from '@/config/appLanguages.js'
import { chooseLanguage, readDeviceLanguage } from '@/services/languagePreference.js'

const AUTOMATIC = 'auto'

// The account page's language setting: a fixed language, or Automatic (the
// browser's). Kept on this device, and in the signed-in account so it follows
// the person (see services/languagePreference.js).
export default function LanguageSection({ headingProps = {}, asField = false }) {
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
    chooseLanguage(code, user)
  }

  // The primary subtag: two letters, or three (e.g. yua).
  const browserLanguage = (navigator.languages?.[0] || navigator.language || '').split('-')[0].toLowerCase()
  const automaticLanguage = (APP_LANGUAGES.find(({ code }) => code === browserLanguage) || APP_LANGUAGES[0]).nativeName

  return (
    <Box component={asField ? 'div' : 'section'} className="oc-language-section">
      {/* asField: a labelled field inside another section (the account's personal info). */}
      {!asField && (
        <Typography component="h2" variant="h6" {...headingProps} id="oc-language-section-title">
          {t('language')}
        </Typography>
      )}
      <TextField select size="small" value={choice} onChange={handleChange} helperText={t('languageHint')} sx={{ width: 280, maxWidth: '100%' }} label={asField ? t('language') : undefined} slotProps={{ select: asField ? {} : { labelId: 'oc-language-section-title' } }}>
        <MenuItem value={AUTOMATIC}>{t('languageAutomatic', { language: automaticLanguage })}</MenuItem>
        {APP_LANGUAGES.map(({ code, nativeName }) => (
          <MenuItem key={code} value={code} lang={code}>
            {nativeName}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  )
}
