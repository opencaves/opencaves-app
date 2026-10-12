import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, Typography } from '@mui/material'
import CheckRounded from '@mui/icons-material/CheckRounded'
import EditNoteRounded from '@mui/icons-material/EditNoteRounded'
import EventAvailableRounded from '@mui/icons-material/EventAvailableRounded'
import HistoryRounded from '@mui/icons-material/HistoryRounded'
import CaveModel from '@/models/CaveModel.js'
import { monthOf, reviewState } from '@/utils/caveReview.js'
import { useReviewMonth } from '@/hooks/useReviewMonth.js'
import { useRequireLogin } from '@/hooks/useRequireLogin.jsx'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import CaveReportMenu from './CaveReportMenu.jsx'

// A 'YYYY-MM' month as a date in it (UTC: the same day wherever it's shown).
const monthDate = (month) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 15))

/**
 * Under one of a cave's sections (config/caveReview.js' REVIEW_SECTIONS), on
 * its page and in the map's pane: how old its information is - "Confirmed
 * Oct 2026", "Last confirmed in 2024" past two years, "Not confirmed yet" -
 * and two actions. Still accurate: an editor stamps the section with this
 * month (Cave.reviewed, through the audit log like any edit: What's new);
 * anyone else is asked to sign in. Something changed: an editor goes to the
 * cave's edit form (on the map, the pane's), anyone else gets the quick
 * reports (CaveReportMenu). The same on the server as in the browser (the
 * page is hydrated): roles only matter on a click.
 *
 * @param {object} props
 * @param {Cave} props.cave
 * @param {'access'|'directions'|'fees'|'description'} props.section
 * @param {Sx} [props.sx]
 */
export default function SectionReview({ cave, section, sx }) {
  const { t, i18n } = useTranslation('caveReview')
  const { t: tPages } = useTranslation('indexPages')
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const roles = useSelector((/** @type {RootState} */ state) => state.session.roles)
  const isLoggedIn = useSelector((/** @type {RootState} */ state) => state.session.isLoggedIn)
  const requireLogin = useRequireLogin('confirm')
  const settleWrite = useSettleWrite()
  const [openSnackbar] = useSnackbar()
  const now = useReviewMonth()
  const [saving, setSaving] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState(null)

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

  function changed(event) {
    if (isEditor) {
      // The pane's own edit form on the map, else the cave's page's.
      navigate(pathname.startsWith('/map') ? `/map/${cave.id}/edit` : `/caves/${cave.id}/edit`)
      return
    }
    setMenuAnchor(event.currentTarget)
  }

  return (
    <Box className={`oc-section-review oc-section-review--${section}`} sx={[{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1, rowGap: 0.25, mt: 1 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Typography className="oc-section-review--age" variant="body2" component="p" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary', mr: 'auto', fontSize: '0.8125rem' }}>
        {state === 'recent' ? <EventAvailableRounded aria-hidden="true" sx={{ fontSize: 18 }} /> : <HistoryRounded aria-hidden="true" sx={{ fontSize: 18 }} />}
        {age}
      </Typography>
      <Box className="oc-section-review--actions" role="group" aria-label={t('question')} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, ml: -1 }}>
        <Button className="oc-section-review--confirm" size="small" startIcon={<CheckRounded />} onClick={confirm} disabled={saving} aria-label={t('stillAccurateLabel', { section: sectionName })} sx={{ textTransform: 'none', borderRadius: 5, px: 1.25 }}>
          {t('stillAccurate')}
        </Button>
        <Button className="oc-section-review--changed" size="small" startIcon={<EditNoteRounded />} onClick={changed} aria-label={t('somethingChangedLabel', { section: sectionName })} sx={{ textTransform: 'none', borderRadius: 5, px: 1.25 }}>
          {t('somethingChanged')}
        </Button>
      </Box>
      <CaveReportMenu cave={cave} anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)} />
    </Box>
  )
}
