import { diffSequences, wordDiff } from './wordDiff.js'

// A unified, line-based diff (like GitHub's), for the Audits page.

// A changed line pair whose words have less than this share in common isn't
// highlighted word by word: it was rewritten, and highlighting it all says
// nothing more than the line's own colour.
const MIN_COMMON_SHARE = 0.3

function splitLines(text) {
  return text ? text.split(/\r?\n/) : []
}

/**
 * [{ type: 'same' | 'removed' | 'added', text, oldNo?, newNo?, parts? }]:
 * each line with its numbers on the old and new sides. In a block of
 * removed lines followed by added ones, the n-th of each are paired, and get
 * `parts` (their {@link wordDiff}, without the other side's words) when they share
 * enough to be the same line edited.
 *
 * @param {string} [before='']
 * @param {string} [after='']
 * @returns {object[]}
 */
export function lineDiff(before = '', after = '') {
  const rows = []
  let oldNo = 0
  let newNo = 0
  for (const { type, value } of diffSequences(splitLines(before), splitLines(after))) {
    if (type === 'same') rows.push({ type, text: value, oldNo: ++oldNo, newNo: ++newNo })
    else if (type === 'removed') rows.push({ type, text: value, oldNo: ++oldNo })
    else rows.push({ type, text: value, newNo: ++newNo })
  }

  // Pairs the removed and added lines of each changed block.
  for (let i = 0; i < rows.length; ) {
    if (rows[i].type === 'same') {
      i++
      continue
    }
    const removed = []
    const added = []
    while (i < rows.length && rows[i].type === 'removed') removed.push(rows[i++])
    while (i < rows.length && rows[i].type === 'added') added.push(rows[i++])
    for (let k = 0; k < Math.min(removed.length, added.length); k++) {
      const parts = wordDiff(removed[k].text, added[k].text)
      const common = parts.filter((p) => p.type === 'same' && p.text.trim()).reduce((sum, p) => sum + p.text.length, 0)
      const longest = Math.max(removed[k].text.length, added[k].text.length)
      if (longest > 0 && common / longest >= MIN_COMMON_SHARE) {
        removed[k].parts = parts.filter((p) => p.type !== 'added')
        added[k].parts = parts.filter((p) => p.type !== 'removed')
      }
    }
  }
  return rows
}

/**
 * The rows as hunks: changed lines with `context` unchanged lines around
 * them, and the longer runs of unchanged lines folded into gaps:
 * [{ kind: 'rows', rows } | { kind: 'gap', rows }]. A gap no longer than
 * what it would hide plus one line isn't worth folding.
 *
 * @param {object[]} rows - {@link lineDiff}'s rows.
 * @param {number} [context=3]
 * @returns {object[]}
 */
export function toHunks(rows, context = 3) {
  const keep = rows.map(() => false)
  rows.forEach((row, i) => {
    if (row.type !== 'same') {
      for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) keep[k] = true
    }
  })
  const items = []
  for (let i = 0; i < rows.length; ) {
    const kind = keep[i] ? 'rows' : 'gap'
    const start = i
    while (i < rows.length && (keep[i] ? 'rows' : 'gap') === kind) i++
    items.push({ kind, rows: rows.slice(start, i) })
  }
  // A one-line gap: shown, not folded behind a button as tall as itself.
  const merged = []
  for (const item of items) {
    const kind = item.kind === 'gap' && item.rows.length < 2 ? 'rows' : item.kind
    const last = merged[merged.length - 1]
    if (last && last.kind === 'rows' && kind === 'rows') last.rows = [...last.rows, ...item.rows]
    else merged.push({ kind, rows: item.rows })
  }
  return merged
}

/**
 * How many lines were added and removed.
 *
 * @param {object[]} rows
 * @returns {{added: number, removed: number}}
 */
export function lineCounts(rows) {
  return { added: rows.filter((r) => r.type === 'added').length, removed: rows.filter((r) => r.type === 'removed').length }
}
