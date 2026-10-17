import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ButtonBase, Tooltip } from '@mui/material'
import FeedbackRounded from '@mui/icons-material/FeedbackRounded'
import { openFeedback } from '@/utils/feedback.js'
import './FeedbackTab.scss'

// Not on the sign-in pages, the admins' Feedback page itself, nor the
// full-screen photo and map viewers (it covered their Next button): a cave's
// or a system's photos, medias or maps, on its page or on the map.
const HIDDEN = [/^\/(login|signup|loading)(\/|$)/, /^\/feedback$/, /^\/(map|caves|sistemas)\/[^/]+\/(photos|medias|maps)(\/|$)/]

/**
 * The Send feedback tab: on the right edge of every page, halfway
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
        // Its focus ring, FeedbackTab.scss's.
        focusVisibleClassName="oc-feedback-tab--focus-visible"
      >
        <FeedbackRounded aria-hidden="true" />
        <span className="oc-feedback-tab--label">
          {t('tab')}
        </span>
      </ButtonBase>
    </Tooltip>
  )
}
