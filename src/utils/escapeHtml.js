/**
 * Text made safe to put in HTML (&, <, >, " and ' as entities).
 *
 * @param {unknown} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}
