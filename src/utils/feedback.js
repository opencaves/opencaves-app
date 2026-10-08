// The Send feedback form (FeedbackDialog), opened from anywhere: the beta's
// What can I do? page (a kind already picked) and the account menu.
// kind: 'bug', 'misleading' or 'idea' (none: the reader picks).
export const OPEN_FEEDBACK_EVENT = 'oc-open-feedback'
export const FEEDBACK_KINDS = ['bug', 'misleading', 'idea']

export function openFeedback(kind) {
  window.dispatchEvent(new CustomEvent(OPEN_FEEDBACK_EVENT, { detail: { kind: FEEDBACK_KINDS.includes(kind) ? kind : null } }))
}

// A report's stages (the admins' Feedback page): open while new, confirmed
// (a real problem, or an idea to do) or in progress; closed once done,
// rejected (not a problem, or not something to do) or a duplicate of another.
export const FEEDBACK_STATUSES = ['new', 'confirmed', 'inProgress', 'done', 'rejected', 'duplicate']
export const OPEN_FEEDBACK_STATUSES = ['new', 'confirmed', 'inProgress']
// Closing a report as one of these emails its author the outcome and the
// admins' note (onFeedbackStatusChanged's TOLD).
export const TOLD_FEEDBACK_STATUSES = ['done', 'rejected']
