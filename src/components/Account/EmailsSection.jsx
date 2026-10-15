import { useEffect, useId, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Typography } from '@mui/material'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import YesNoSwitch from '@/components/YesNoSwitch.jsx'
import { sectionAnchorSx } from '@/components/formSectionHeading.js'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'
import { saveEmailPreference, watchEmailPreferences } from '@/services/emailPreferences.js'

// Each switch: its setting on _users, and its texts' key (account.emails).
/** @type {{setting: 'feedbackEmails'|'newsEmails', key: string}[]} */
const SWITCHES = [
  { setting: 'feedbackEmails', key: 'feedbackReplies' },
  { setting: 'newsEmails', key: 'news' },
]

/**
 * One of the Emails section's switches: its label and hint, saved at once
 * and confirmed by a snackbar.
 *
 * @param {object} props
 * @param {string} props.uid
 * @param {'feedbackEmails'|'newsEmails'} props.setting
 * @param {string} props.textKey - Its texts' key in account.emails.
 * @param {boolean|null} props.enabled - Null while loading.
 * @param {(enabled: boolean) => void} props.onChange - The value shown, set at once (put back if the save fails).
 */
function EmailSwitch({ uid, setting, textKey, enabled, onChange }) {
  const { t } = useTranslation('account', { keyPrefix: 'emails' })
  const [saving, setSaving] = useState(false)
  const [openSnackbar] = useSnackbar()
  const settleWrite = useSettleWrite()
  const labelId = useId()
  const hintId = useId()

  async function handleChange(_, checked) {
    const previous = enabled
    onChange(checked)
    setSaving(true)
    try {
      const status = await settleWrite(saveEmailPreference(uid, setting, checked), { name: t('title') })
      if (status === 'saved') openSnackbar(t(`${textKey}${checked ? 'On' : 'Off'}`), { severity: 'success' })
    } catch (error) {
      console.error(error)
      onChange(previous)
      openSnackbar(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box component="label" className={`oc-emails-section--${textKey}`} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, cursor: 'pointer' }}>
      <Box sx={{ minWidth: 0, flex: 1, pt: 0.75 }}>
        <Typography id={labelId}>{t(textKey)}</Typography>
        <Typography id={hintId} variant="body2" color="text.secondary">
          {t(`${textKey}Hint`)}
        </Typography>
      </Box>
      <YesNoSwitch className="oc-emails-section--switch" checked={enabled ?? true} disabled={enabled === null || saving} onChange={handleChange} slotProps={{ input: { 'aria-labelledby': labelId, 'aria-describedby': hintId } }} />
    </Box>
  )
}

/**
 * The account page's Emails section: whether the team's replies to the
 * person's feedback, and news from OpenCaves, are emailed to them - each its
 * own switch, on by default (the emails' unsubscribe links turn them off).
 * Saved at once, confirmed by a snackbar. Signed-in accounts only. Its
 * anchor: #emails.
 *
 * @param {object} props
 * @param {object} [props.headingProps] - The section heading's props (the account page's).
 */
export default function EmailsSection({ headingProps = {} }) {
  const { t } = useTranslation('account', { keyPrefix: 'emails' })
  const user = useSelector((/** @type {RootState} */ state) => state.session.user)
  const uid = user && !user.isAnonymous ? user.uid : null
  const [settings, setSettings] = useState(/** @type {{feedbackEmails: boolean, newsEmails: boolean}|null} */ (null))

  useEffect(() => {
    if (!uid) return undefined
    return watchEmailPreferences(uid, setSettings, (error) => console.error(error))
  }, [uid])

  if (!uid) return null

  return (
    <Box component="section" className="oc-emails-section" id="emails" sx={sectionAnchorSx}>
      <Typography {...headingProps}>{t('title')}</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {SWITCHES.map(({ setting, key }) => (
          <EmailSwitch key={setting} uid={uid} setting={setting} textKey={key} enabled={settings ? settings[setting] : null} onChange={(enabled) => setSettings((current) => ({ ...current, [setting]: enabled }))} />
        ))}
      </Box>
    </Box>
  )
}
