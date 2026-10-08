import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ButtonBase, Tooltip } from '@mui/material'
import FeedbackOutlined from '@mui/icons-material/FeedbackOutlined'
import { openFeedback } from '@/utils/feedback.js'

// Not on the sign-in pages, the admins' Feedback page itself, nor the
// full-screen photo and map viewers (it covered their Next button): a cave's
// or a system's photos, medias or maps, on its page or on the map.
const HIDDEN = [/^\/(login|signup|loading)(\/|$)/, /^\/feedback$/, /^\/(map|caves|sistemas)\/[^/]+\/(photos|medias|maps)(\/|$)/]

// The Send feedback tab (beta): on the right edge of every page, halfway
// down - written sideways, the icon alone on a phone. Opens FeedbackDialog.
// On a phone's map it fades out with the map's buttons as the result pane's
// sheet rises (ResultPaneSm's --oc-map-controls-* variables).
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
          justifyContent: 'center',
          gap: 1,
          writingMode: 'vertical-rl',
          // A phone: MD3's 24dp icon in a 48dp touch target - 40dp shown on the
          // edge, the 8dp left of it still catching taps (::before).
          width: { xs: 40, sm: 'auto' },
          minHeight: { xs: 48, sm: 0 },
          px: { xs: 0, sm: 1 },
          py: { xs: 1.5, sm: 2 },
          borderRadius: '12px 0 0 12px',
          bgcolor: theme.vars.palette.secondary.main,
          color: theme.vars.palette.secondary.contrastText,
          boxShadow: theme.vars.shadows[3],
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.04em',
          opacity: 'var(--oc-map-controls-opacity, 1)',
          visibility: 'var(--oc-map-controls-visibility, visible)',
          transition: 'padding 150ms, background-color 150ms, opacity 150ms ease, visibility 150ms ease',
          '&::before': { content: '""', position: 'absolute', top: 0, bottom: 0, left: -8, width: 8 },
          '& svg': { fontSize: 24, transform: { sm: 'rotate(90deg)' } },
          '&:hover': { bgcolor: theme.vars.palette.secondary.dark },
          '&:hover, &.Mui-focusVisible': { pr: { sm: 1.5 } },
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
