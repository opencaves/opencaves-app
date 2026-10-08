import { useEffect, useId, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Button, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material'
import CheckRounded from '@mui/icons-material/CheckRounded'
import TranslateRounded from '@mui/icons-material/TranslateRounded'
import { APP_LANGUAGES } from '@/config/appLanguages.js'
import { chooseLanguage, readDeviceLanguage } from '@/services/languagePreference.js'

export const AUTOMATIC = 'auto'

// The app language picked (a code, or AUTOMATIC: the browser's), kept in step
// with changes made elsewhere (another picker, the account's language applied
// at sign-in), and the name of the language Automatic gives.
export function useLanguageChoice() {
  const { i18n } = useTranslation()
  const user = useSelector((state) => state.session.user)
  const [choice, setChoice] = useState(() => readDeviceLanguage() || AUTOMATIC)

  useEffect(() => {
    const sync = () => setChoice(readDeviceLanguage() || AUTOMATIC)
    i18n.on('languageChanged', sync)
    return () => i18n.off('languageChanged', sync)
  }, [i18n])

  function choose(next) {
    setChoice(next)
    chooseLanguage(next === AUTOMATIC ? null : next, user)
  }

  // The primary subtag: two letters, or three (e.g. yua).
  const browserLanguage = (navigator.languages?.[0] || navigator.language || '').split('-')[0].toLowerCase()
  const automaticName = (APP_LANGUAGES.find(({ code }) => code === browserLanguage) || APP_LANGUAGES[0]).nativeName
  const currentName = choice === AUTOMATIC ? automaticName : APP_LANGUAGES.find(({ code }) => code === choice)?.nativeName

  return { choice, choose, automaticName, currentName }
}

// The menu of languages, Automatic first, the current one checked.
function LanguageOptions({ id, anchorEl, onClose, language }) {
  const { t } = useTranslation('languagePicker')
  const options = [{ code: AUTOMATIC, nativeName: t('automatic', { language: language.automaticName }) }, ...APP_LANGUAGES]
  return (
    <Menu id={id} className="oc-language-picker--menu" anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
      {options.map(({ code, nativeName }) => (
        <MenuItem
          key={code}
          lang={code === AUTOMATIC ? undefined : code}
          selected={code === language.choice}
          onClick={() => {
            onClose()
            language.choose(code)
          }}
          sx={{ minHeight: 48 }}
        >
          <ListItemIcon>{code === language.choice && <CheckRounded fontSize="small" />}</ListItemIcon>
          {nativeName}
        </MenuItem>
      ))}
    </Menu>
  )
}

// A menu row (the account menu, the phone's drawer): Language, the current
// one below it, opening the list of languages.
export function LanguageListItem({ sx }) {
  const { t } = useTranslation('languagePicker')
  const language = useLanguageChoice()
  const [anchorEl, setAnchorEl] = useState(null)
  const menuId = useId()
  return (
    <>
      <ListItemButton
        className="oc-language-picker"
        aria-haspopup="menu"
        aria-expanded={anchorEl ? 'true' : undefined}
        aria-controls={anchorEl ? menuId : undefined}
        // stopPropagation: the drawer closes on any click inside it.
        onClick={(event) => {
          event.stopPropagation()
          setAnchorEl(event.currentTarget)
        }}
        sx={sx}
      >
        <ListItemIcon>
          <TranslateRounded />
        </ListItemIcon>
        <ListItemText primary={t('label')} secondary={language.currentName} />
      </ListItemButton>
      <LanguageOptions id={menuId} anchorEl={anchorEl} onClose={() => setAnchorEl(null)} language={language} />
    </>
  )
}

// A text button for a page's foot: the current language, opening the list.
export function LanguageButton({ sx }) {
  const { t } = useTranslation('languagePicker')
  const language = useLanguageChoice()
  const [anchorEl, setAnchorEl] = useState(null)
  const menuId = useId()
  return (
    <>
      <Button
        className="oc-language-picker--button"
        color="inherit"
        startIcon={<TranslateRounded fontSize="small" />}
        aria-label={`${t('label')}: ${language.currentName}`}
        aria-haspopup="menu"
        aria-expanded={anchorEl ? 'true' : undefined}
        aria-controls={anchorEl ? menuId : undefined}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        // A 48 px touch target.
        sx={[{ minHeight: 48, px: 1.5, textTransform: 'none', typography: 'body2', borderRadius: 6 }, ...(Array.isArray(sx) ? sx : [sx])]}
      >
        {language.currentName}
      </Button>
      <LanguageOptions id={menuId} anchorEl={anchorEl} onClose={() => setAnchorEl(null)} language={language} />
    </>
  )
}
