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
import { CAVE_REPORT_KINDS, CAVE_REPORT_NOTE_MAX_LENGTH, CAVE_WARNING_REPORTS, reportedValue } from '@/config/caveReview.js'
import AccessIcon from '@/components/accessIcons.jsx'
import { toServiceLanguage } from '@/utils/lang.js'
import { useRequireLogin } from '@/hooks/useRequireLogin.jsx'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'
import FlagRounded from '@mui/icons-material/FlagRounded'
import { openFeedback } from '@/utils/feedback.js'
import { track } from '@/utils/track.js'

const ICONS = { closed: <BlockRounded fontSize="small" />, private: <LockRounded fontSize="small" />, fees: <PaymentsRounded fontSize="small" />, road: <AltRouteRounded fontSize="small" /> }

// An item's label and its description under it, compact: a small line
// close under the label, wrapped (the menu is kept narrow).
const TEXT_SLOTS = { root: { sx: { my: 0.25 } }, secondary: { sx: { fontSize: '0.75rem', lineHeight: 1.3, whiteSpace: 'normal' } } }

// A kind's icon: a proposed value's (its table's), else the quick report's.
const iconOf = (kind) => {
  const proposed = reportedValue(kind)
  return proposed ? <AccessIcon table={proposed.table} value={proposed.value} fontSize="small" /> : ICONS[kind]
}

/**
 * A cave's quick reports (What changed?): a menu of what changed - the
 * card's own (`kinds`: under Access, its other access values, then its
 * other accessibility values - each a group under its heading, with its icon
 * and its table's texts - then the other fees: It's free now, There are fees
 * now - both, without "now", when unknown; Road changed), then Something else (the Send feedback form about
 * the section, `page`) - opened at anchorEl. Picking one asks for an
 * optional note, then sends it to the admins as a /feedback report (kind
 * misleading, with caveId and caveReport; its browser in _feedbackPrivate,
 * one batch, as FeedbackDialog). A proposed value (access:permission,
 * fees:no...) is applied by an admin from the report's page. Access
 * forbidden and Permission needed (and the older Closed, Now private) also
 * show a public warning on the cave at once (onCaveReportChanged,
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
  const { t: tTables } = useTranslation(['accesses', 'accessibilities', 'fees'])
  // A kind's name and its line: a proposed value's from its table's texts
  // (the fees': said as a change, unless they're unknown).
  const labelOf = (item) => {
    const proposed = reportedValue(item)
    if (proposed?.field === 'fees') return t(`fees.${proposed.value}${typeof cave.fees === 'boolean' ? 'Now' : ''}`)
    return proposed ? tTables(`${proposed.value}.label`, { ns: proposed.table }) : t(`kinds.${item}`)
  }
  const textOf = (item) => {
    const proposed = reportedValue(item)
    return proposed ? tTables(`${proposed.value}.description`, { ns: proposed.table }) : t(`kindText.${item}`)
  }
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
      const proposed = reportedValue(kind)
      const said = proposed?.field === 'fees' ? t(`message.fees_${proposed.value}`, { name }) : proposed ? t(`message.${proposed.field}`, { name, value: labelOf(kind) }) : t(`message.${kind}`, { name })
      const message = [said, note.trim()].filter(Boolean).join('\n\n')
      const report = { kind: 'misleading', caveId: cave.id, caveReport: kind, message, page: page || `/caves/${cave.id}`, language: toServiceLanguage(i18n.language), userId: auth.currentUser.uid, createdAt: serverTimestamp(), status: 'new' }
      const reportRef = doc(collection(db, FEEDBACK_COLLECTION))
      const batch = writeBatch(db)
      batch.set(reportRef, report)
      batch.set(doc(db, FEEDBACK_PRIVATE_COLLECTION, reportRef.id), { browser: navigator.userAgent.slice(0, 500) })
      const status = await settleWrite(batch.commit(), { name: t('itemName') })
      setKind(null)
      if (status === 'saved') {
        track('report_change', { cave_id: cave.id, kind, page: page || undefined })
        openSnackbar(t('sent'), { severity: 'success' })
      }
    } catch (error) {
      console.error(error)
      openSnackbar(t('error'))
    } finally {
      setSending(false)
    }
  }

  // Each group's values in alphabetical order (their names in the reader's
  // language, leading article left out); the groups, and the other kinds,
  // keep their order.
  const groupOf = (item, index) => {
    const field = reportedValue(item)?.field
    return field ? kinds.findIndex((other) => reportedValue(other)?.field === field) : index
  }
  const collator = new Intl.Collator(i18n.resolvedLanguage, { sensitivity: 'base' })
  // A leading article left out ("A key is needed" under K): the language's
  // own (sortArticles; an elided one, l', sticks to its word).
  const articles = t('sortArticles').split(' ').filter(Boolean)
  const sortName = (label) => {
    const lower = label.toLocaleLowerCase(i18n.resolvedLanguage)
    const article = articles.find((word) => lower.startsWith(/['’]$/.test(word) ? word : `${word} `))
    return article ? label.slice(article.length).trimStart() : label
  }
  const sorted = kinds.map((item, index) => ({ item, group: groupOf(item, index), label: sortName(labelOf(item)) }))
    .sort((a, b) => a.group - b.group || collator.compare(a.label, b.label))
    .map(({ item }) => item)

  const close = () => !sending && setKind(null)
  const warns = CAVE_WARNING_REPORTS.includes(kind)

  return (
    <>
      <Menu className="oc-cave-report-menu" anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose} slotProps={{ list: { 'aria-label': t('menuLabel') }, paper: { sx: { maxWidth: 340 } } }}>
        {/* Its question as its title (not a small caption): bold, in the
            text's colour, a warning sign before it, a line under it. */}
        <Typography component="li" role="presentation" className="oc-cave-report-menu--title" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1, pb: 1.25, mb: 0.5, fontSize: '0.9375rem', fontWeight: 600, color: 'text.primary', borderBottom: 1, borderColor: 'divider' }}>
          <WarningAmberRounded aria-hidden="true" fontSize="small" color="warning" />
          {t('menuLabel')}
        </Typography>
        {sorted.flatMap((item, index) => {
          // A group's heading before its first value: Access is now,
          // Accessibility is now (the fees' values say it themselves).
          const field = reportedValue(item)?.field
          const previous = reportedValue(sorted[index - 1])?.field
          const heading = field && field !== 'fees' && field !== previous
            ? [<Typography key={`${field}-heading`} component="li" role="presentation" className="oc-cave-report-menu--group" sx={{ display: 'block', px: 2, pt: index ? 0.75 : 0.25, pb: 0.25, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'text.secondary', ...(index && { borderTop: 1, borderColor: 'divider', mt: 0.5 }) }}>{t(`groups.${field}`)}</Typography>]
            : []
          // A line before the items after a group (the fees, Road changed).
          const after = index && !heading.length && field !== previous
          return [...heading, (
            <MenuItem key={item} dense className={`oc-cave-report-menu--${item.replace(':', '-')}`} onClick={() => pick(item)} sx={after ? { borderTop: 1, borderColor: 'divider', mt: 0.5, pt: 0.75 } : undefined}>
              <ListItemIcon>{iconOf(item)}</ListItemIcon>
              <ListItemText primary={labelOf(item)} secondary={textOf(item)} slotProps={TEXT_SLOTS} />
            </MenuItem>
          )]
        })}
        {/* Anything else wrong there: the feedback form, about the section. */}
        <MenuItem dense className="oc-cave-report-menu--other" onClick={() => {
          onClose()
          track('report_change', { cave_id: cave.id, kind: 'other', page: page || undefined })
          openFeedback('misleading', { page: page || `/caves/${cave.id}` })
        }} sx={kinds.length ? { borderTop: 1, borderColor: 'divider', mt: 0.5, pt: 0.75 } : undefined}>
          <ListItemIcon><FlagRounded fontSize="small" /></ListItemIcon>
          <ListItemText primary={t('kinds.other')} secondary={t('kindText.other')} slotProps={TEXT_SLOTS} />
        </MenuItem>
      </Menu>

      <Dialog className="oc-cave-report-dialog" open={Boolean(kind)} onClose={close} fullScreen={fullScreen} maxWidth="xs" fullWidth aria-labelledby="oc-cave-report-title" slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : 7 } } }}>
        <DialogTitle id="oc-cave-report-title" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 7 }}>
          <Box component="span" aria-hidden="true" sx={(theme) => ({ display: 'grid', placeItems: 'center', width: 40, height: 40, flexShrink: 0, borderRadius: '50%', bgcolor: theme.vars.sys.color.secondaryContainer, color: theme.vars.sys.color.onSecondaryContainer })}>
            {kind && iconOf(kind)}
          </Box>
          {kind && t('dialogTitle', { kind: labelOf(kind) })}
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
