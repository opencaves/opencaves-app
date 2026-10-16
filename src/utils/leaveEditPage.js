/**
 * Leaves an edit page (its back arrow, Exit, Cancel) without leaving it in
 * the history: a step back when it was opened from within the app (the
 * record's page, the list, wherever) - a link up would stack a new entry, the
 * browser's Back then returning to the form - otherwise (opened straight at
 * its address) up to `fallback`, in this entry's place.
 *
 * @param {import('react-router-dom').NavigateFunction} navigate
 * @param {string} fallback - Where to go when there's no step back in the app.
 */
export function leaveEditPage(navigate, fallback) {
  if (window.history.state?.idx > 0) navigate(-1)
  else navigate(fallback, { replace: true })
}
