// Text diffs for the Audits page: diffSequences (any two lists of strings),
// wordDiff (words within a text or a line) - lineDiff.js builds the
// line-based view on them.

// Past this many cells (items of one side x items of the other, once the
// common start and end are set aside), the middle is reported as removed then
// added rather than diffed: the table would cost too much memory and time.
const MAX_CELLS = 4_000_000

/**
 * The longest common subsequence of two lists, after setting aside their
 * common start and end (an edit usually touches a small part):
 * [{ type: 'same' | 'removed' | 'added', value }], in order, removals before
 * additions where both happen at one place.
 *
 * @param {Array} a
 * @param {Array} b
 * @returns {{type: 'same'|'removed'|'added', value: *}[]}
 */
export function diffSequences(a, b) {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }

  /** @type {{type: 'same'|'removed'|'added', value: *}[]} */
  const ops = []
  for (let k = 0; k < start; k++) ops.push({ type: 'same', value: a[k] })

  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  const n = midA.length
  const m = midB.length

  if (n * m > MAX_CELLS) {
    midA.forEach((value) => ops.push({ type: 'removed', value }))
    midB.forEach((value) => ops.push({ type: 'added', value }))
  } else if (n || m) {
    // lengths[i * width + j]: the LCS length of midA[i..] and midB[j..].
    const width = m + 1
    const lengths = new Uint32Array((n + 1) * width)
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lengths[i * width + j] = midA[i] === midB[j] ? lengths[(i + 1) * width + j + 1] + 1 : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        ops.push({ type: 'same', value: midA[i] })
        i++
        j++
      } else if (lengths[(i + 1) * width + j] >= lengths[i * width + j + 1]) {
        ops.push({ type: 'removed', value: midA[i++] })
      } else {
        ops.push({ type: 'added', value: midB[j++] })
      }
    }
    while (i < n) ops.push({ type: 'removed', value: midA[i++] })
    while (j < m) ops.push({ type: 'added', value: midB[j++] })
  }

  for (let k = endA; k < a.length; k++) ops.push({ type: 'same', value: a[k] })
  return ops
}

function tokenize(text) {
  // Words and the whitespace between them, as separate tokens.
  return text.match(/\s+|[^\s]+/g) || []
}

/**
 * A word-level diff of two texts: [{ type: 'same' | 'removed' | 'added',
 * text }], whitespace kept, so joining the parts gives back either text.
 *
 * @param {string} [before='']
 * @param {string} [after='']
 * @returns {{type: 'same'|'removed'|'added', text: string}[]}
 */
export function wordDiff(before = '', after = '') {
  /** @type {{type: 'same'|'removed'|'added', text: string}[]} */
  const parts = []
  for (const { type, value } of diffSequences(tokenize(before), tokenize(after))) {
    const last = parts[parts.length - 1]
    if (last && last.type === type) last.text += value
    else parts.push({ type, text: value })
  }
  return parts
}
