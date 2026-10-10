// The Send feedback form (FeedbackDialog), opened from anywhere: the What can I do?
// page, the account menu and the feedback tab.
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
// The stages a reply can close a report with ("Send and mark as..."): the
// reply's email then carries the outcome (onFeedbackReplied). A stage changed
// on its own emails no one.
export const TOLD_FEEDBACK_STATUSES = ['done', 'rejected']
// A thread message's longest text: a team reply (firestore.rules' _feedback
// messages), an author's answer by email (cut there: functions' constants.js).
export const FEEDBACK_REPLY_MAX_LENGTH = 10000
