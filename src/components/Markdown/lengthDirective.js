import { directive } from 'micromark-extension-directive'
import { directiveFromMarkdown } from 'mdast-util-directive'
import { visit } from 'unist-util-visit'

export const plainTextOf = (node) => plainText(node)

// The descriptions' length tag, a generic-directive text directive:
// `:length[45 m]` or `:length[148 ft]` - the value and unit as the author
// measured them. The app shows it in the reader's units (Markdown's Length
// component); Markdown viewers that don't know it show the raw tag.
export const LENGTH_DIRECTIVE = 'length'

// The units a length can be written in: their size, their system, and the
// unit a reader of the other system sees them in (mi <-> km, ft <-> m...).
// `spellings` is matched whole and case-insensitively; `inText` are the
// spellings also looked for in free text (findLength): not "mi", a common
// word there. Lengths for cave descriptions: no mm, cm or inches.
export const LENGTH_UNITS = {
  m: { metres: 1, system: 'metric', counterpart: 'ft', spellings: ['m', 'meters?', 'metres?'] },
  km: { metres: 1000, system: 'metric', counterpart: 'mi', spellings: ['km', 'kilometers?', 'kilometres?'] },
  ft: { metres: 0.3048, system: 'imperial', counterpart: 'm', spellings: ['ft', 'feets?', 'foot', "'"] },
  yd: { metres: 0.9144, system: 'imperial', counterpart: 'm', spellings: ['yd', 'yds', 'yards?'] },
  mi: { metres: 1609.344, system: 'imperial', counterpart: 'km', spellings: ['mi', 'miles?'], inText: ['miles?'] },
}

const unitOf = (spelling) => Object.keys(LENGTH_UNITS).find((unit) => LENGTH_UNITS[unit].spellings.some((s) => new RegExp(`^${s}$`, 'i').test(spelling)))
const toNumber = (digits) => Number(digits.replace(/[\s,]/g, ''))

/**
 * "45 m", "13.7m", "148 ft", "148'", "1,234 ft", "2 miles" -> { value, unit,
 * metres } or null.
 *
 * @param {string} text
 * @returns {{value: number, unit: string, metres: number}|null}
 */
export function parseLength(text) {
  const match = /^\s*(\d[\d\s,.]*)\s*([a-z']+)\s*$/i.exec(text || '')
  const unit = match && unitOf(match[2])
  const value = match && toNumber(match[1])
  if (!unit || !Number.isFinite(value)) return null
  return { value, unit, metres: value * LENGTH_UNITS[unit].metres, significantDigits: significantDigits(match[1]), written: match[1].trim() }
}

// How precise the written value is: its significant digits. "200" -> 1,
// "1,240" -> 3, "21.0" -> 3, "7.25" -> 3. Trailing zeros of a whole number
// count as placeholders, not as measured.
function significantDigits(written) {
  const digits = written.replace(/[\s,]/g, '')
  const [whole, decimals = ''] = digits.split('.')
  const significant = digits.includes('.') ? (whole + decimals).replace(/^0+/, '') : whole.replace(/^0+/, '').replace(/0+$/, '')
  return Math.max(1, significant.length)
}

// Longest spellings first, so "km" isn't read as "k" + "m".
export const TEXT_SPELLINGS = Object.values(LENGTH_UNITS)
  .flatMap((u) => u.inText || u.spellings)
  .sort((a, b) => b.length - a.length)
  .join('|')

/**
 * The first length in some text ("about 200 meters!"): its place in the
 * text (index, length) and parseLength's result, or null.
 *
 * @param {string} text
 * @returns {{value: number, unit: string, metres: number, index: number, length: number}|null}
 */
export function findLength(text) {
  const match = new RegExp(`(\\d[\\d,.]*(?:\\s\\d{3})*)\\s*(${TEXT_SPELLINGS})(?![a-z])`, 'i').exec(text || '')
  const parsed = match && parseLength(`${match[1]} ${match[2]}`)
  return parsed ? { ...parsed, index: match.index, length: match[0].length } : null
}

const plainText = (node) => (node.children || []).map((child) => (child.type === 'text' ? child.value : plainText(child))).join('')

// The directive as its author typed it, for every directive that isn't a
// length: remark-directive also reads ordinary text ("Note:see", "::") as
// directives, which must stay text.
function asText(node) {
  const marks = node.type === 'containerDirective' ? ':::' : node.type === 'leafDirective' ? '::' : ':'
  const label = node.children?.length && node.type !== 'containerDirective' ? `[${plainText(node)}]` : ''
  const attributes = node.attributes && Object.keys(node.attributes).length ? `{${Object.entries(node.attributes).map(([k, v]) => (v ? `${k}="${v}"` : k)).join(' ')}}` : ''
  return `${marks}${node.name}${label}${attributes}`
}

/**
 * The remark plugin, for the page renderer (react-markdown) and the editor
 * (Milkdown): parses directives (micromark-extension-directive), keeps
 * `:length[...]` - marked for the renderer as <span data-length="45 m"> - and
 * turns every other directive back into its text. Parsing only: saving goes
 * through the editor's own serializer, which writes a length back as its raw
 * tag - remark-directive's serializer would also escape every colon in the
 * text ("Note\:see").
 */
export default function remarkLengthDirective() {
  const data = this.data()
  ;(data.micromarkExtensions || (data.micromarkExtensions = [])).push(directive())
  ;(data.fromMarkdownExtensions || (data.fromMarkdownExtensions = [])).push(directiveFromMarkdown())
  return (tree) => {
    visit(tree, ['textDirective', 'leafDirective', 'containerDirective'], (node, index, parent) => {
      if (node.type === 'textDirective' && node.name === LENGTH_DIRECTIVE) {
        const text = plainText(node)
        node.data = { hName: 'span', hProperties: { className: ['oc-length'], dataLength: text } }
        return
      }
      if (!parent || index == null) return
      const text = { type: 'text', value: asText(node) }
      if (node.type === 'textDirective') {
        parent.children.splice(index, 1, text)
      } else if (node.type === 'leafDirective') {
        parent.children.splice(index, 1, { type: 'paragraph', children: [text] })
      } else {
        parent.children.splice(index, 1, { type: 'paragraph', children: [text] }, ...(node.children || []), { type: 'paragraph', children: [{ type: 'text', value: ':::' }] })
      }
      return index
    })
  }
}
