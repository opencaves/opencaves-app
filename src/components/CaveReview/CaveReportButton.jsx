import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@mui/material'
import CaveReportMenu from './CaveReportMenu.jsx'
import ArrowDropDownRounded from '@mui/icons-material/ArrowDropDownRounded'
import { SECTION_ANCHORS, SECTION_REPORT_KINDS } from '@/config/caveReview.js'
import { openFeedback } from '@/utils/feedback.js'
import { track } from '@/utils/track.js'

/**
 * Report a change, next to a section's Still accurate (SectionReview): a
 * quiet text button opening that section's quick reports and Something else
 * (CaveReportMenu); a section with no quick report of its own (the
 * description) opens the Send feedback form about it at once. For everyone,
 * editors included (a cave closed is the admins' to confirm).
 *
 * @param {object} props
 * @param {Cave} props.cave
 * @param {'access'|'directions'|'fees'|'description'} props.section
 * @param {Sx} [props.sx]
 */
export default function CaveReportButton({ cave, section, sx }) {
  const { t } = useTranslation('caveReview', { keyPrefix: 'report' })
  const [anchorEl, setAnchorEl] = useState(null)
  const kinds = SECTION_REPORT_KINDS[section] || []
  const page = `/caves/${cave.id}#${SECTION_ANCHORS[section] || section}`
  const onClick = (event) => {
    if (kinds.length) {
      setAnchorEl(event.currentTarget)
      return
    }
    // Straight to the feedback form (the description).
    track('report_change', { cave_id: cave.id, kind: 'other', page })
    openFeedback('misleading', { page })
  }
  return (
    <>
      <Button className="oc-cave-report-button" size="small" endIcon={kinds.length ? <ArrowDropDownRounded /> : undefined} aria-haspopup={kinds.length ? 'menu' : 'dialog'} onClick={onClick} sx={[{ textTransform: 'none', borderRadius: 999, height: 32, px: 1.25 }, ...(Array.isArray(sx) ? sx : [sx])]}>
        {t('button')}
      </Button>
      {kinds.length > 0 && <CaveReportMenu cave={cave} anchorEl={anchorEl} onClose={() => setAnchorEl(null)} kinds={kinds} page={page} />}
    </>
  )
}
