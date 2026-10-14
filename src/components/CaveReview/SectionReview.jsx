import { useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, Typography } from '@mui/material'
import CheckRounded from '@mui/icons-material/CheckRounded'
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded'
import CaveModel from '@/models/CaveModel.js'
import { monthOf, reviewState } from '@/utils/caveReview.js'
import { useReviewMonth } from '@/hooks/useReviewMonth.js'
import { useRequireLogin } from '@/hooks/useRequireLogin.jsx'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import CaveReportButton from './CaveReportButton.jsx'
import { loadFirebase } from '@/utils/loadFirebase.js'

// A 'YYYY-MM' month as a date in it (UTC: the same day wherever it's shown).
const monthDate = (month) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 15))

/**
 * Under one of a cave's sections (config/caveReview.js' REVIEW_SECTIONS), on
 * its page and in the map's pane: how old its information is - "Confirmed
 * Oct 2026", "Last confirmed in 2024" past two years, "Not confirmed yet" -
 * under its Still accurate button (a check once confirmed; a warning sign
 * and "Still accurate?" until then or past two years): an editor stamps the
 * section with this month (Cave.reviewed, through the audit log like any
 * edit: What's new). A toggle: selected (filled) while confirmed; a
 * section confirmed this month is taken back by another click (to its month
 * before, known from this visit, or none) - an older confirmation is
 * re-confirmed, never erased. Anyone else is asked to sign in. Next to it, Report a
 * change (CaveReportButton): that section's quick reports, or anything else
 * wrong there - for everyone. The same on the server as in
 * the browser (the page is hydrated): roles only matter on a click.
 *
 * @param {object} props
 * @param {Cave} props.cave
 * @param {'access'|'directions'|'fees'|'description'} props.section
 * @param {Sx} [props.sx]
 */
export default function SectionReview({ cave, section, sx }) {
  const { t, i18n } = useTranslation('caveReview')
  const { t: tPages } = useTranslation('indexPages')
  const roles = useSelector((/** @type {RootState} */ state) => state.session.roles)
  const isLoggedIn = useSelector((/** @type {RootState} */ state) => state.session.isLoggedIn)
  const requireLogin = useRequireLogin('confirm')
  const settleWrite = useSettleWrite()
  const [openSnackbar, closeSnackbar] = useSnackbar()
  const now = useReviewMonth()
  const [saving, setSaving] = useState(false)
  // The section's month before a confirmation made in this visit: taking it
  // back puts it back (none known: not confirmed).
  const previous = useRef(undefined)

  const month = cave.reviewed?.[section]
  const state = reviewState(month, now)
  const sectionName = t(`sections.${section}`)
  const age =
    state === 'recent'
      ? t('confirmed', { section: sectionName, date: new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(monthDate(month)) })
      : state === 'stale'
        ? t('stale', { section: sectionName, year: month.slice(0, 4) })
        : t('never', { section: sectionName })
  const isEditor = roles.includes('editor')

  async function confirm() {
    if (!isLoggedIn || !isEditor) {
      requireLogin()
      return
    }
    setSaving(true)
    const name = cave.name?.value?.trim() || tPages('unnamedCavePlain')
    const before = month
    try {
      // Merged: the other sections' months stay.
      const status = await settleWrite(CaveModel.save(cave.id, { reviewed: { [section]: monthOf() } }), { name })
      if (status === 'saved') {
        previous.current = before
        openSnackbar(t('saved', { section: sectionName, name }), { severity: 'success' })
      }
    } catch (error) {
      console.error(error)
      openSnackbar(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  // Room above and below it (padding: the pages placing it set its margins);
  // on the right, under its section.
  // This month's confirmation taken back (the button toggles: its label
  // doesn't say it's a yes only) - only this month's, so an older one,
  // someone else's maybe, is never erased: the section's month as it was
  // before this visit's confirmation, or none (Firebase's deleteField, loaded
  // on demand like the rest of it).
  async function takeBack() {
    if (!isLoggedIn || !isEditor) {
      requireLogin()
      return
    }
    setSaving(true)
    const name = cave.name?.value?.trim() || tPages('unnamedCavePlain')
    closeSnackbar()
    try {
      const { deleteField } = await loadFirebase()
      const status = await settleWrite(CaveModel.save(cave.id, { reviewed: { [section]: previous.current || deleteField() } }), { name })
      if (status === 'saved') {
        previous.current = undefined
        openSnackbar(t('undone', { section: sectionName, name }))
      }
    } catch (error) {
      console.error(error)
      openSnackbar(t('undoError'))
    } finally {
      setSaving(false)
    }
  }
  // Selected while it's confirmed; confirmed this month, a click takes it back.
  const selected = state === 'recent'
  const takesBack = selected && month === now

  // The two buttons' color, shared: the primary's dark shade in light mode
  // (AAA, 7:1 on the page's ground), amber when the section is to check (not
  // confirmed yet, or too long ago). In the dark theme toned down into the
  // page's ground (it stood out more than a secondary action should): text
  // about 6.6:1, outline 3.4:1, amber 7.7:1.
  const warn = !selected
  const colors = (theme) => {
    const quiet = (color, share) => `color-mix(in srgb, ${color} ${share}%, ${theme.vars.palette.background.default})`
    const tone = (dark) => (warn ? (dark ? quiet(theme.vars.palette.warning.main, 80) : theme.vars.palette.warning.dark) : (dark ? quiet(theme.vars.sys.color.primary, 75) : theme.vars.palette.primary.dark))
    const edge = (dark) => (warn ? tone(dark) : dark ? quiet(theme.vars.sys.color.outline, 70) : theme.vars.sys.color.outline)
    return { tone, edge }
  }

  return (
    <Box className={`oc-section-review oc-section-review--${section}`} sx={[{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'flex-start', columnGap: 1, rowGap: 0.5, py: 1.5 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {/* Confirm it, its age under it; beside it, report what changed there
          (its own quick reports: CaveReportButton) - wrapping under on a
          narrow phone. The group on its section's right. */}
      <Box className="oc-section-review--confirm-group" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        {/* An outlined pill (as the app's other outlined buttons), so it
            reads as something to press, no taller than before (32px): its
            outline in M3's outline color (4.4:1 light - a control's edge
            needs 3:1). A toggle: filled while confirmed. A tint on hover, a
            ripple when pressed. */}
        <Button className="oc-section-review--confirm" variant="outlined" size="small" startIcon={selected ? <CheckRounded /> : <WarningAmberRounded />} onClick={takesBack ? takeBack : confirm} disabled={saving} aria-pressed={selected} aria-label={t('stillAccurateLabel', { section: sectionName })}
          sx={(theme) => {
            const { tone, edge } = colors(theme)
            const look = (dark) => ({
              color: tone(dark),
              borderColor: edge(dark),
              // Selected (confirmed): a tinted fill, as M3's selected toggle.
              bgcolor: selected ? 'color-mix(in srgb, currentColor 12%, transparent)' : 'transparent',
              '&:hover': { borderColor: edge(dark), bgcolor: `color-mix(in srgb, currentColor ${selected ? 18 : 8}%, transparent)` },
            })
            // The icon 13px in from the outline (MUI pulls a small button's
            // icon 2px left), the text's end a little more.
            return { textTransform: 'none', borderRadius: 999, height: 32, pl: '15px', pr: 2, ...look(false), ...theme.applyStyles('dark', look(true)) }
          }}>
          {selected ? t('stillAccurate') : t('stillAccurateQuestion')}
        </Button>
        {/* Its age, under it, flush with its left edge. */}
        <Typography className="oc-section-review--age" variant="body2" component="p" sx={{ color: 'text.secondary', fontSize: '0.8125rem', mt: '4px' }}>
          {age}
        </Typography>
      </Box>
      <CaveReportButton cave={cave} section={section} sx={(theme) => {
        const { tone } = colors(theme)
        return { color: tone(false), ...theme.applyStyles('dark', { color: tone(true) }) }
      }} />
    </Box>
  )
}
