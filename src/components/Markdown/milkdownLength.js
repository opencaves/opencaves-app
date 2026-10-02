import { $nodeSchema, $remark } from '@milkdown/utils'
import remarkLengthDirective, { LENGTH_DIRECTIVE, plainTextOf } from './lengthDirective.js'

// The `:length[45 m]` tag in the Markdown editor (MarkdownField): parsed by
// the same remark plugin as the page, shown as a chip holding the value as
// written, and written back as its raw tag (an 'html' node: saved as is, so
// the brackets aren't escaped).
export const lengthRemark = $remark('remarkLengthDirective', () => remarkLengthDirective)

export const lengthSchema = $nodeSchema('length_directive', () => ({
  group: 'inline',
  inline: true,
  atom: true,
  attrs: { text: { default: '' } },
  parseDOM: [{ tag: 'span[data-length]', getAttrs: (dom) => ({ text: dom.getAttribute('data-length') || '' }) }],
  toDOM: (node) => ['span', { 'data-length': node.attrs.text, class: 'oc-length-chip' }, node.attrs.text],
  parseMarkdown: {
    match: (node) => node.type === 'textDirective' && node.name === LENGTH_DIRECTIVE,
    runner: (state, node, type) => {
      state.addNode(type, { text: plainTextOf(node) })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'length_directive',
    runner: (state, node) => {
      state.addNode('html', undefined, `:${LENGTH_DIRECTIVE}[${node.attrs.text}]`)
    },
  },
}))

export const milkdownLength = [lengthRemark, lengthSchema].flat()
