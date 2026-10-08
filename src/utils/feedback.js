// The Send feedback form (FeedbackDialog), opened from anywhere: the beta's
// What can I do? page (a kind already picked) and the account menu.
// kind: 'bug', 'misleading' or 'idea' (none: the reader picks).
export const OPEN_FEEDBACK_EVENT = 'oc-open-feedback'
export const FEEDBACK_KINDS = ['bug', 'misleading', 'idea']

export function openFeedback(kind) {
  window.dispatchEvent(new CustomEvent(OPEN_FEEDBACK_EVENT, { detail: { kind: FEEDBACK_KINDS.includes(kind) ? kind : null } }))
}
