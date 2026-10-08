import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ButtonBase, Tooltip } from '@mui/material'
import FeedbackOutlined from '@mui/icons-material/FeedbackOutlined'
import { openFeedback } from '@/utils/feedback.js'

// Where it would cover something: the map (its controls), the forms (their
// Save bar), the photo and map viewers, the sign-in pages, and the admins'
// Feedback page itself.
const HIDDEN = [/^\/map(\/|$)/, /\/edit(\/|$)/, /\/photos\//, /\/maps\//, /^\/map-layers/, /^\/(login|signup|loading)(\/|$)/, /^\/feedback$/]

// The Send feedback tab (beta): on the right edge of every page, halfway
// down - written sideways, the icon alone on a phone. Opens FeedbackDialog.
export default function FeedbackTab() {
  const { t } = useTranslation('feedback')
  const { pathname } = useLocation()
  if (HIDDEN.some((pattern) => pattern.test(pathname))) return null

  return (
    <Tooltip title={t('title')} placement="left">
      <ButtonBase
        className="oc-feedback-tab"
        aria-label={t('title')}
        onClick={() => openFeedback()}
        sx={(theme) => ({
          position: 'fixed',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: theme.zIndex.speedDial,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          writingMode: 'vertical-rl',
          px: { xs: 0.75, sm: 1 },
          py: { xs: 1.25, sm: 2 },
          borderRadius: '12px 0 0 12px',
          bgcolor: theme.vars.sys.color.primary,
          color: theme.vars.palette.background.paper,
          boxShadow: theme.vars.shadows[3],
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.04em',
          transition: 'padding 150ms',
          '& svg': { fontSize: 20, transform: { sm: 'rotate(90deg)' } },
          '&:hover, &.Mui-focusVisible': { pr: { xs: 1, sm: 1.5 } },
          '&.Mui-focusVisible': { outline: `2px solid ${theme.vars.sys.color.primary}`, outlineOffset: 2 },
          '& .oc-feedback-tab--label': { display: { xs: 'none', sm: 'inline' } },
          '@media print': { display: 'none' },
        })}
      >
        <FeedbackOutlined aria-hidden="true" />
        <span className="oc-feedback-tab--label">
          {t('tab')}
        </span>
      </ButtonBase>
    </Tooltip>
  )
}
