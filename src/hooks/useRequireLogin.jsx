import { useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { buildContinueUrl } from '@/redux/slices/sessionSlice.jsx'

export const AUTH_PROMPT_EVENT = 'oc-auth-prompt'

// For an action only accounts can take (adding a photo, a video or a map,
// sending feedback): asks first why an account is needed (AuthPromptDialog,
// worded for the action) - it jumped straight to a bare log-in page - then
// signs up or logs in, coming back here afterwards. reason: 'photos',
// 'videos', 'maps', 'feedback' (else a general wording).
export function useRequireLogin(reason = 'default') {
  const location = useLocation()
  return useCallback(() => {
    window.dispatchEvent(new CustomEvent(AUTH_PROMPT_EVENT, { detail: { reason, continueUrl: buildContinueUrl(location) } }))
  }, [location, reason])
}
