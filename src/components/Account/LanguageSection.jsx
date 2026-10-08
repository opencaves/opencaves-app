import { useTranslation } from 'react-i18next'
import { Box, MenuItem, TextField, Typography } from '@mui/material'
import { APP_LANGUAGES } from '@/config/appLanguages.js'
import { AUTOMATIC, useLanguageChoice } from '@/components/LanguagePicker.jsx'

// The account page's language setting: a fixed language, or Automatic (the
// browser's). Kept on this device, and in the signed-in account so it follows
// the person (see services/languagePreference.js).
export default function LanguageSection({ headingProps = {}, asField = false }) {
  const { t } = useTranslation('account')
  // Also picks up the account's language when it's applied at sign-in.
  const { choice, choose, automaticName } = useLanguageChoice()

  return (
    // id: the #language anchor (/account#language, linked from the welcome email).
    <Box component={asField ? 'div' : 'section'} className="oc-language-section" id="language" sx={{ scrollMarginTop: 'calc(64px + 16px)' }}>
      {/* asField: a labelled field inside another section (the account's personal info). */}
      {!asField && (
        <Typography component="h2" variant="h6" {...headingProps} id="oc-language-section-title">
          {t('language')}
        </Typography>
      )}
      <TextField select size="small" value={choice} onChange={(event) => choose(event.target.value)} helperText={t('languageHint')} sx={{ width: 340, maxWidth: '100%' }} label={asField ? t('language') : undefined} slotProps={{ select: asField ? {} : { labelId: 'oc-language-section-title' } }}>
        <MenuItem value={AUTOMATIC}>{t('languageAutomatic', { language: automaticName })}</MenuItem>
        {APP_LANGUAGES.map(({ code, nativeName }) => (
          <MenuItem key={code} value={code} lang={code}>
            {nativeName}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  )
}
