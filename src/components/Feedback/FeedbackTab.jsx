import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ButtonBase, Tooltip } from '@mui/material'
import FeedbackRounded from '@mui/icons-material/FeedbackRounded'
import { openFeedback } from '@/utils/feedback.js'

// Not on the sign-in pages, the admins' Feedback page itself, nor the
// full-screen photo and map viewers (it covered their Next button): a cave's
// or a system's photos, medias or maps, on its page or on the map.
const HIDDEN = [/^\/(login|signup|loading)(\/|$)/, /^\/feedback$/, /^\/(map|caves|sistemas)\/[^/]+\/(photos|medias|maps)(\/|$)/]

// A screen whose smaller side is a phone's (portrait or landscape).
const COMPACT = '@media (max-width: 599.95px), (max-height: 599.95px)'

/**
 * The Send feedback tab (beta): on the right edge of every page, halfway
 * down - written sideways, the icon alone on a phone. Opens FeedbackDialog.
 * On a phone's map it fades out with the map's buttons as the result pane's
 * sheet rises (ResultPaneSm's --oc-map-controls-* variables).
 */
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
          // The label written sideways; compact on a small screen (COMPACT).
          px: 1,
          py: 2,
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
          '& svg': { fontSize: 24, transform: 'rotate(90deg)' },
          '&:hover': { bgcolor: theme.vars.palette.secondary.dark },
          '&:hover, &.Mui-focusVisible': { pr: 1.5 },
          '&.Mui-focusVisible': { outline: `2px solid ${theme.vars.sys.color.primary}`, outlineOffset: 2 },
          // A small screen - its smaller side under 600px, so a phone held
          // sideways too: the icon alone, MD3's 24dp icon in a 48dp touch target
          // (40dp shown on the edge, the 8dp left of it still catching taps).
          [COMPACT]: {
            width: 40,
            minHeight: 48,
            px: 0,
            py: 1.5,
            '& svg': { transform: 'none' },
            '&:hover, &.Mui-focusVisible': { pr: 0 },
            '& .oc-feedback-tab--label': { display: 'none' },
          },
          '@media print': { display: 'none' },
        })}
      >
        <FeedbackRounded aria-hidden="true" />
        <span className="oc-feedback-tab--label">
          {t('tab')}
        </span>
      </ButtonBase>
    </Tooltip>
  )
}
