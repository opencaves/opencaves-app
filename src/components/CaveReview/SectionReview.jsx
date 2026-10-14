import { useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, ButtonGroup, Typography } from '@mui/material'
import CheckRounded from '@mui/icons-material/CheckRounded'
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded'
import ArrowDropDownRounded from '@mui/icons-material/ArrowDropDownRounded'
import CaveModel from '@/models/CaveModel.js'
import { monthOf, reviewState } from '@/utils/caveReview.js'
import { SECTION_ANCHORS, SECTION_REPORT_KINDS, accessProposals } from '@/config/caveReview.js'
import { useReviewMonth } from '@/hooks/useReviewMonth.js'
import { useRequireLogin } from '@/hooks/useRequireLogin.jsx'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import CaveReportMenu from './CaveReportMenu.jsx'
import { loadFirebase } from '@/utils/loadFirebase.js'
import { track } from '@/utils/track.js'
import { useCaveData } from '@/hooks/useCaveData.js'

// A 'YYYY-MM' month as a date in it (UTC: the same day wherever it's shown).
const monthDate = (month) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 15))

/**
 * The foot of one of a cave's cards, on its page and in the map's pane:
 * whether what the card says is still right - one control for the whole
 * card, its sections (config/caveReview.js' REVIEW_SECTIONS: the Access
 * card's access and fees) confirmed together. On the left, how old the
 * card's information is (its oldest section): "Confirmed Oct 2026", "Last
 * confirmed in 2024" past two years, "Partly confirmed", "Not confirmed
 * yet". On the right, a split button:
 * - its main part, Still accurate: an editor stamps every section with this
 *   month (Cave.reviewed, through the audit log like any edit: What's new).
 *   A toggle - selected (filled) while all are confirmed; confirmed this
 *   month, another click takes it back (each section to its month before,
 *   known from this visit, or none) - an older confirmation is re-confirmed,
 *   never erased. Anyone else is asked to sign in;
 * - its arrow, What changed?: the card's quick reports - the Access card's
 *   other access, accessibility and fees values (accessProposals); Road
 *   changed - and Something else (CaveReportMenu), for everyone.
 * The same on the server as in the browser (the page is hydrated): roles
 * only matter on a click.
 *
 * @param {object} props
 * @param {Cave} props.cave
 * @param {('access'|'directions'|'fees'|'description')[]} props.sections - The card's sections.
 * @param {Sx} [props.sx]
 */
export default function SectionReview({ cave, sections, sx }) {
  const { t, i18n } = useTranslation('caveReview')
  const { t: tPages } = useTranslation('indexPages')
  const roles = useSelector((/** @type {RootState} */ state) => state.session.roles)
  const isLoggedIn = useSelector((/** @type {RootState} */ state) => state.session.isLoggedIn)
  const requireLogin = useRequireLogin('confirm')
  const settleWrite = useSettleWrite()
  const [openSnackbar, closeSnackbar] = useSnackbar()
  const now = useReviewMonth()
  const [saving, setSaving] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState(null)
  // Each section's month before a confirmation made in this visit: taking
  // it back puts them back (none known: not confirmed).
  const previous = useRef(undefined)
  // The access and accessibility tables (the page's data: the server sends them).
  const { accesses, accessibilities } = useCaveData()

  const months = sections.map((section) => cave.reviewed?.[section])
  const states = months.map((month) => reviewState(month, now))
  // The card's age: its oldest section's.
  const oldest = months.every(Boolean) ? [...months].sort()[0] : undefined
  const sectionNames = new Intl.ListFormat(i18n.resolvedLanguage, { type: 'conjunction' }).format(sections.map((section) => t(`sections.${section}`)))
  // Selected while every section is confirmed; confirmed this month, a click takes it back.
  const selected = states.every((state) => state === 'recent')
  const takesBack = selected && months.every((month) => month === now)
  const age = selected
    ? t('card.confirmed', { date: new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(monthDate(oldest)) })
    : months.every((month) => !month)
      ? t('card.never')
      : oldest
        ? t('card.stale', { year: oldest.slice(0, 4) })
        : t('card.partly')
  const isEditor = roles.includes('editor')
  const name = cave.name?.value?.trim() || tPages('unnamedCavePlain')

  async function confirm() {
    if (!isLoggedIn || !isEditor) {
      requireLogin()
      return
    }
    setSaving(true)
    const before = Object.fromEntries(sections.map((section, i) => [section, months[i]]))
    try {
      // Merged: the other sections' months stay.
      const month = monthOf()
      const status = await settleWrite(CaveModel.save(cave.id, { reviewed: Object.fromEntries(sections.map((section) => [section, month])) }), { name })
      if (status === 'saved') {
        previous.current = before
        track('review_confirm', { cave_id: cave.id, section: sections.join(',') })
        openSnackbar(t('saved', { section: sectionNames, name }), { severity: 'success' })
      }
    } catch (error) {
      console.error(error)
      openSnackbar(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  // This month's confirmation taken back (the button toggles: its label
  // doesn't say it's a yes only) - only this month's, so an older one,
  // someone else's maybe, is never erased: each section's month as it was
  // before this visit's confirmation, or none (Firebase's deleteField, loaded
  // on demand like the rest of it).
  async function takeBack() {
    if (!isLoggedIn || !isEditor) {
      requireLogin()
      return
    }
    setSaving(true)
    closeSnackbar()
    try {
      const { deleteField } = await loadFirebase()
      const status = await settleWrite(CaveModel.save(cave.id, { reviewed: Object.fromEntries(sections.map((section) => [section, previous.current?.[section] || deleteField()])) }), { name })
      if (status === 'saved') {
        previous.current = undefined
        track('review_take_back', { cave_id: cave.id, section: sections.join(',') })
        openSnackbar(t('undone', { section: sectionNames, name }))
      }
    } catch (error) {
      console.error(error)
      openSnackbar(t('undoError'))
    } finally {
      setSaving(false)
    }
  }

  // The card's quick reports, in its sections' order; Something else is
  // about its first section's place on the page.
  // The Access card: its other access, accessibility and fees values.
  const proposals = sections.includes('access') ? accessProposals(cave, accesses, accessibilities) : []
  const kinds = [...proposals, ...sections.flatMap((section) => SECTION_REPORT_KINDS[section] || [])]
  const page = `/caves/${cave.id}#${SECTION_ANCHORS[sections[0]] || sections[0]}`

  // The button's color: the primary's dark shade in light mode (AAA, 7:1 on
  // the card), amber when the card is to check (not confirmed yet, partly,
  // or too long ago). In the dark theme toned down into the background (it
  // stood out more than a secondary action should): text about 6.6:1,
  // outline 3.4:1, amber 7.7:1.
  const warn = !selected
  const look = (theme) => {
    const quiet = (color, share) => `color-mix(in srgb, ${color} ${share}%, ${theme.vars.palette.background.default})`
    const tone = (dark) => (warn ? (dark ? quiet(theme.vars.palette.warning.main, 80) : theme.vars.palette.warning.dark) : (dark ? quiet(theme.vars.sys.color.primary, 75) : theme.vars.palette.primary.dark))
    const edge = (dark) => (warn ? tone(dark) : dark ? quiet(theme.vars.sys.color.outline, 70) : theme.vars.sys.color.outline)
    const colors = (dark) => ({
      '& .MuiButton-root, & .MuiButton-root:hover': { color: tone(dark), borderColor: edge(dark) },
      // Selected (confirmed): a tinted fill, as M3's selected toggle.
      '& .MuiButton-root': { bgcolor: selected ? 'color-mix(in srgb, currentColor 12%, transparent)' : 'transparent' },
      '& .MuiButton-root:hover': { bgcolor: `color-mix(in srgb, currentColor ${selected ? 18 : 8}%, transparent)` },
    })
    return { ...colors(false), ...theme.applyStyles('dark', colors(true)) }
  }

  return (
    <Box className={`oc-section-review oc-section-review--${sections.join('-')}`} sx={[{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 1.5, rowGap: 1 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {/* How old the card's information is, on the left: its length never
          moves the button. */}
      <Typography className="oc-section-review--age" variant="body2" component="p" sx={{ color: 'text.secondary', fontSize: '0.8125rem', m: 0 }}>
        {age}
      </Typography>
      {/* An outlined pill split in two, no taller than before (32px): its
          outline in M3's outline color (4.4:1 light - a control's edge needs
          3:1). The main part a toggle (filled while confirmed), the arrow the
          change menu. A tint on hover, a ripple when pressed. */}
      <ButtonGroup className="oc-section-review--split" variant="outlined" size="small" disabled={saving} sx={(theme) => ({ ml: 'auto', '& .MuiButton-root': { textTransform: 'none', height: 32 }, '& .MuiButtonGroup-firstButton': { borderRadius: '999px 0 0 999px', pl: '15px', pr: 1.5 }, '& .MuiButtonGroup-lastButton': { borderRadius: '0 999px 999px 0', px: 0.5, minWidth: 36 }, ...look(theme) })}>
        <Button className="oc-section-review--confirm" startIcon={selected ? <CheckRounded /> : <WarningAmberRounded />} onClick={takesBack ? takeBack : confirm} aria-pressed={selected} aria-label={t('stillAccurateLabel', { section: sectionNames })}>
          {selected ? t('stillAccurate') : t('stillAccurateQuestion')}
        </Button>
        <Button className="oc-section-review--report" onClick={(event) => setMenuAnchor(event.currentTarget)} aria-haspopup="menu" aria-expanded={Boolean(menuAnchor)} aria-label={t('report.menuLabel')}>
          <ArrowDropDownRounded />
        </Button>
      </ButtonGroup>
      <CaveReportMenu cave={cave} anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)} kinds={kinds} page={page} />
    </Box>
  )
}
