import { useEffect, useId, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Switch, Typography } from '@mui/material'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'
import { saveFeedbackEmails, watchFeedbackEmails } from '@/services/feedbackEmailsPreference.js'

/**
 * The account page's Emails section: whether the team's replies to the
 * person's feedback are emailed to them (on by default; the emails'
 * unsubscribe link turns it off). Saved at once, confirmed by a snackbar.
 * Signed-in accounts only.
 */
export default function FeedbackEmailsSection({ headingProps = {} }) {
  const { t } = useTranslation('account', { keyPrefix: 'emails' })
  const user = useSelector((/** @type {RootState} */ state) => state.session.user)
  const uid = user && !user.isAnonymous ? user.uid : null
  const [enabled, setEnabled] = useState(null)
  const [saving, setSaving] = useState(false)
  const [openSnackbar] = useSnackbar()
  const settleWrite = useSettleWrite()
  const labelId = useId()
  const hintId = useId()

  useEffect(() => {
    if (!uid) return undefined
    return watchFeedbackEmails(uid, setEnabled, (error) => console.error(error))
  }, [uid])

  if (!uid) return null

  async function handleChange(_, checked) {
    const previous = enabled
    setEnabled(checked)
    setSaving(true)
    try {
      const status = await settleWrite(saveFeedbackEmails(uid, checked), { name: t('title') })
      if (status === 'saved') openSnackbar(t(checked ? 'turnedOn' : 'turnedOff'), { severity: 'success' })
    } catch (error) {
      console.error(error)
      setEnabled(previous)
      openSnackbar(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box component="section" className="oc-feedback-emails-section">
      <Typography {...headingProps}>{t('title')}</Typography>
      <Box component="label" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, cursor: 'pointer' }}>
        <Box sx={{ minWidth: 0, flex: 1, pt: 0.75 }}>
          <Typography id={labelId}>{t('feedbackReplies')}</Typography>
          <Typography id={hintId} variant="body2" color="text.secondary">
            {t('feedbackRepliesHint')}
          </Typography>
        </Box>
        <Switch className="oc-feedback-emails-section--switch" checked={enabled ?? true} disabled={enabled === null || saving} onChange={handleChange} slotProps={{ input: { 'aria-labelledby': labelId, 'aria-describedby': hintId } }} />
      </Box>
    </Box>
  )
}
