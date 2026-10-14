import { useState } from 'react'
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

// A 'YYYY-MM' month as a date in it (UTC: the same day wherever it's shown).
const monthDate = (month) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 15))

/**
 * Under one of a cave's sections (config/caveReview.js' REVIEW_SECTIONS), on
 * its page and in the map's pane: how old its information is - "Confirmed
 * Oct 2026", "Last confirmed in 2024" past two years, "Not confirmed yet" -
 * under its Still accurate button (a check once confirmed; a warning sign
 * and "Still accurate?" until then or past two years): an editor stamps the
 * section with this month (Cave.reviewed, through the audit log like any
 * edit: What's new); anyone else is asked to sign in. (A change is reported from the cave's
 * Report a change button, CaveReportButton.) The same on the server as in
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
  const [openSnackbar] = useSnackbar()
  const now = useReviewMonth()
  const [saving, setSaving] = useState(false)

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
    try {
      // Merged: the other sections' months stay.
      const status = await settleWrite(CaveModel.save(cave.id, { reviewed: { [section]: monthOf() } }), { name })
      if (status === 'saved') openSnackbar(t('saved', { section: sectionName, name }), { severity: 'success' })
    } catch (error) {
      console.error(error)
      openSnackbar(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  // Room above and below it (padding: the pages placing it set its margins).
  return (
    <Box className={`oc-section-review oc-section-review--${section}`} sx={[{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', py: 1.5 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {/* An outlined pill (as the app's other outlined buttons), so it reads
          as something to press, no taller than before (32px): its outline in
          M3's outline color (4.4:1 light - a control's edge needs 3:1); its
          text the primary's dark shade in light mode (AAA, 7:1 on the page's
          ground), the dark theme's primary, toned down. Not confirmed yet, or
          too long ago: amber, outline and all - the sections to check stand
          out. A tint on hover, a ripple when pressed. */}
      <Button className="oc-section-review--confirm" variant="outlined" size="small" startIcon={state === 'recent' ? <CheckRounded /> : <WarningAmberRounded />} onClick={confirm} disabled={saving} aria-label={t('stillAccurateLabel', { section: sectionName })}
        sx={(theme) => {
          const warn = state !== 'recent'
          // In the dark theme, its colors toned down into the page's ground
          // (it stood out more than a secondary action should): text about
          // 6.6:1, outline 3.4:1, amber 7.7:1.
          const quiet = (color, share) => `color-mix(in srgb, ${color} ${share}%, ${theme.vars.palette.background.default})`
          const tone = (dark) => (warn ? (dark ? quiet(theme.vars.palette.warning.main, 80) : theme.vars.palette.warning.dark) : (dark ? quiet(theme.vars.sys.color.primary, 75) : theme.vars.palette.primary.dark))
          const edge = (dark) => (dark ? quiet(theme.vars.sys.color.outline, 70) : theme.vars.sys.color.outline)
          const look = (dark) => ({
            color: tone(dark),
            borderColor: warn ? tone(dark) : edge(dark),
            '&:hover': { borderColor: warn ? tone(dark) : edge(dark), bgcolor: 'color-mix(in srgb, currentColor 8%, transparent)' },
          })
          // The icon 13px in from the outline (MUI pulls a small button's
          // icon 2px left), the text's end a little more.
          return { textTransform: 'none', borderRadius: 999, height: 32, pl: '15px', pr: 2, ...look(false), ...theme.applyStyles('dark', look(true)) }
        }}>
        {state === 'recent' ? t('stillAccurate') : t('stillAccurateQuestion')}
      </Button>
      {/* Its age under it, flush with the button's left edge. */}
      <Typography className="oc-section-review--age" variant="body2" component="p" sx={{ color: 'text.secondary', fontSize: '0.8125rem', mt: '4px' }}>
        {age}
      </Typography>
    </Box>
  )
}
