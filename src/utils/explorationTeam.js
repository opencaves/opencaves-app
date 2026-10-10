/**
 * An exploration's team as a list of names (one per person or group). It was
 * one free-text string - "Bil Phillips, Robert Schmittner" - and older records
 * still hold one: it's cut at its commas and semicolons. The server's index
 * pages repeat this (functions/js/seo/indexPages.js).
 *
 * @param {string|string[]} team
 * @returns {string[]}
 */
export function teamNames(team) {
  if (Array.isArray(team)) return team.map((name) => String(name || '').trim()).filter(Boolean)
  return String(team || '').split(/\s*[,;]\s*/).map((name) => name.trim()).filter(Boolean)
}

/**
 * The team as shown: its names, comma-separated.
 */
export const teamLabel = (team) => teamNames(team).join(', ')
