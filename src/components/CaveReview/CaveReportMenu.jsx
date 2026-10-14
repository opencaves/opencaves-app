import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, ListItemIcon, ListItemText, Menu, MenuItem, TextField, Typography, useMediaQuery, useTheme } from '@mui/material'
import BlockRounded from '@mui/icons-material/BlockRounded'
import LockRounded from '@mui/icons-material/LockRounded'
import PaymentsRounded from '@mui/icons-material/PaymentsRounded'
import AltRouteRounded from '@mui/icons-material/AltRouteRounded'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded'
import { loadFirebase } from '@/utils/loadFirebase.js'
import { FEEDBACK_COLLECTION, FEEDBACK_PRIVATE_COLLECTION } from '@/config/collections.js'
import { CAVE_REPORT_KINDS, CAVE_REPORT_NOTE_MAX_LENGTH, CAVE_WARNING_REPORTS } from '@/config/caveReview.js'
import { toServiceLanguage } from '@/utils/lang.js'
import { useRequireLogin } from '@/hooks/useRequireLogin.jsx'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'
import FlagRounded from '@mui/icons-material/FlagRounded'
import { openFeedback } from '@/utils/feedback.js'

const ICONS = { closed: <BlockRounded />, private: <LockRounded />, fees: <PaymentsRounded />, road: <AltRouteRounded /> }

/**
 * A cave's quick reports (Report a change): a menu of what changed - the
 * section's own (`kinds`: Closed, Now private under Access; Fees changed;
 * Road changed), then Something else (the Send feedback form about the
 * section, `page`) - opened at anchorEl. Picking one
 * asks for an optional note, then sends it to the admins as a /feedback
 * report (kind misleading, with caveId and caveReport; its browser in
 * _feedbackPrivate, one batch, as FeedbackDialog). Closed and Now private
 * also show a public warning on the cave at once (onCaveReportChanged,
 * CaveReportWarnings) until an admin resolves the report. An account is
 * needed: anyone else is asked to sign up or log in first.
 *
 * @param {object} props
 * @param {Cave} props.cave
 * @param {HTMLElement|null} props.anchorEl - The button it opens from; null: closed.
 * @param {() => void} props.onClose
 * @param {string[]} [props.kinds] - Its quick reports ({@link CAVE_REPORT_KINDS}'s, every one by default).
 * @param {string} [props.page] - What Something else is about: the section on the cave's page.
 */
export default function CaveReportMenu({ cave, anchorEl, onClose, kinds = CAVE_REPORT_KINDS, page }) {
  const { t, i18n } = useTranslation('caveReview', { keyPrefix: 'report' })
  const { t: tPages } = useTranslation('indexPages')
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const isLoggedIn = useSelector((/** @type {RootState} */ state) => state.session.isLoggedIn)
  const requireLogin = useRequireLogin('report')
  const settleWrite = useSettleWrite()
  const [openSnackbar] = useSnackbar()
  const [kind, setKind] = useState(null)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  function pick(picked) {
    onClose()
    if (!isLoggedIn) {
      requireLogin()
      return
    }
    setNote('')
    setKind(picked)
  }

  async function send() {
    setSending(true)
    try {
      const { auth, db, collection, doc, serverTimestamp, writeBatch } = await loadFirebase()
      const name = cave.name?.value?.trim() || tPages('unnamedCavePlain')
      const message = [t(`message.${kind}`, { name }), note.trim()].filter(Boolean).join('\n\n')
      const report = { kind: 'misleading', caveId: cave.id, caveReport: kind, message, page: page || `/caves/${cave.id}`, language: toServiceLanguage(i18n.language), userId: auth.currentUser.uid, createdAt: serverTimestamp(), status: 'new' }
      const reportRef = doc(collection(db, FEEDBACK_COLLECTION))
      const batch = writeBatch(db)
      batch.set(reportRef, report)
      batch.set(doc(db, FEEDBACK_PRIVATE_COLLECTION, reportRef.id), { browser: navigator.userAgent.slice(0, 500) })
      const status = await settleWrite(batch.commit(), { name: t('itemName') })
      setKind(null)
      if (status === 'saved') openSnackbar(t('sent'), { severity: 'success' })
    } catch (error) {
      console.error(error)
      openSnackbar(t('error'))
    } finally {
      setSending(false)
    }
  }

  const close = () => !sending && setKind(null)
  const warns = CAVE_WARNING_REPORTS.includes(kind)

  return (
    <>
      <Menu className="oc-cave-report-menu" anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose} slotProps={{ list: { 'aria-label': t('menuLabel') } }}>
        <Typography variant="overline" component="li" role="presentation" sx={{ display: 'block', px: 2, pt: 0.5, color: 'text.secondary', lineHeight: 2 }}>
          {t('menuLabel')}
        </Typography>
        {kinds.map((item) => (
          <MenuItem key={item} className={`oc-cave-report-menu--${item}`} onClick={() => pick(item)}>
            <ListItemIcon>{ICONS[item]}</ListItemIcon>
            <ListItemText primary={t(`kinds.${item}`)} secondary={t(`kindText.${item}`)} />
          </MenuItem>
        ))}
        {/* Anything else wrong there: the feedback form, about the section. */}
        <MenuItem className="oc-cave-report-menu--other" onClick={() => {
          onClose()
          openFeedback('misleading', { page: page || `/caves/${cave.id}` })
        }} sx={kinds.length ? { borderTop: 1, borderColor: 'divider', mt: 0.5, pt: 1 } : undefined}>
          <ListItemIcon><FlagRounded /></ListItemIcon>
          <ListItemText primary={t('kinds.other')} secondary={t('kindText.other')} />
        </MenuItem>
      </Menu>

      <Dialog className="oc-cave-report-dialog" open={Boolean(kind)} onClose={close} fullScreen={fullScreen} maxWidth="xs" fullWidth aria-labelledby="oc-cave-report-title" slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : 7 } } }}>
        <DialogTitle id="oc-cave-report-title" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 7 }}>
          <Box component="span" aria-hidden="true" sx={(theme) => ({ display: 'grid', placeItems: 'center', width: 40, height: 40, flexShrink: 0, borderRadius: '50%', bgcolor: theme.vars.sys.color.secondaryContainer, color: theme.vars.sys.color.onSecondaryContainer })}>
            {kind && ICONS[kind]}
          </Box>
          {kind && t('dialogTitle', { kind: t(`kinds.${kind}`) })}
        </DialogTitle>
        <DialogCloseButton onClick={close} disabled={sending} label={t('close')} />
        <DialogContent>
          {/* Whether it shows on the cave at once, or only reaches the team. */}
          <Box className="oc-cave-report-dialog--note" sx={(theme) => ({ display: 'flex', gap: 1.25, alignItems: 'flex-start', p: 1.5, mb: 2, borderRadius: 3, bgcolor: theme.vars.sys.color.surfaceContainer })}>
            {warns ? <WarningAmberRounded aria-hidden="true" color="warning" /> : <InfoOutlined aria-hidden="true" color="primary" />}
            <Typography variant="body2">{warns ? t('warningNote') : t('teamNote')}</Typography>
          </Box>
          <TextField
            label={t('noteLabel')}
            placeholder={t('notePlaceholder')}
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, CAVE_REPORT_NOTE_MAX_LENGTH))}
            multiline
            minRows={3}
            fullWidth
            autoFocus
            helperText={`${note.length} / ${CAVE_REPORT_NOTE_MAX_LENGTH}`}
            slotProps={{ formHelperText: { sx: { textAlign: 'right' } } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={close} disabled={sending}>
            {t('cancel')}
          </Button>
          <Button variant="contained" disableElevation onClick={send} disabled={sending} sx={{ borderRadius: 5, px: 2.5 }}>
            {t('send')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
