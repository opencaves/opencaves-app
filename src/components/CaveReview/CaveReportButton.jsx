import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@mui/material'
import FlagRounded from '@mui/icons-material/FlagRounded'
import CaveReportMenu from './CaveReportMenu.jsx'

/**
 * A cave's Report a change button (its page, the map's pane): opens the
 * quick reports (CaveReportMenu) - for everyone, editors included (a cave
 * closed is the admins' to confirm).
 *
 * @param {object} props
 * @param {Cave} props.cave
 * @param {Sx} [props.sx]
 */
export default function CaveReportButton({ cave, sx }) {
  const { t } = useTranslation('caveReview', { keyPrefix: 'report' })
  const [anchorEl, setAnchorEl] = useState(null)
  return (
    <>
      <Button className="oc-cave-report-button" variant="outlined" startIcon={<FlagRounded />} aria-haspopup="menu" onClick={(event) => setAnchorEl(event.currentTarget)} sx={[{ textTransform: 'none', borderRadius: 5 }, ...(Array.isArray(sx) ? sx : [sx])]}>
        {t('button')}
      </Button>
      <CaveReportMenu cave={cave} anchorEl={anchorEl} onClose={() => setAnchorEl(null)} />
    </>
  )
}
