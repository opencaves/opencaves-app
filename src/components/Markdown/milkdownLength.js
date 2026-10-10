import { $inputRule, $nodeSchema, $remark, $view } from '@milkdown/utils'
import { TextSelection } from '@milkdown/prose/state'
import { InputRule } from '@milkdown/prose/inputrules'
import remarkLengthDirective, { LENGTH_DIRECTIVE, LENGTH_UNITS, TEXT_SPELLINGS, parseLength, plainTextOf } from './lengthDirective.js'

// The `:length[45 m]` tag in the Markdown editor (MarkdownField): parsed by
// the same remark plugin as the page, shown as a chip, and written back as
// its raw tag (an 'html' node: saved as is, so the brackets aren't escaped).
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

// The chip, edited in place: its value is a text field, its unit a dropdown
// shown while the chip has the focus (the unit as text otherwise). Each change
// is written to the tag at once. Enter and the arrows at either end of the
// value go back to the text; leaving the chip with no value removes it
// (a tag just inserted gives back the text it replaced).
// Escape cancels: a tag just inserted gives back the text it replaced and its
// selection (options.cancelInsert), another gets its value back from when the
// chip got the focus.
class LengthView {
  constructor(node, view, getPos, labels, options) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.options = options

    this.dom = document.createElement('span')
    this.dom.className = 'oc-length-chip'
    this.dom.contentEditable = 'false'

    this.input = document.createElement('input')
    this.input.className = 'oc-length-chip--value'
    this.input.inputMode = 'decimal'
    this.input.setAttribute('aria-label', labels.value)

    this.unitText = document.createElement('span')
    this.unitText.className = 'oc-length-chip--unit'

    this.select = document.createElement('select')
    this.select.className = 'oc-length-chip--select'
    this.select.setAttribute('aria-label', labels.unit)
    for (const unit of Object.keys(LENGTH_UNITS)) this.select.add(new Option(unit, unit))

    this.dom.append(this.input, this.unitText, this.select)
    this.show(node)

    this.input.addEventListener('input', () => {
      this.fit()
      this.write()
    })
    this.select.addEventListener('change', () => this.write())
    // The unit as text: a click goes to its dropdown.
    this.unitText.addEventListener('mousedown', (event) => {
      event.preventDefault()
      this.select.focus()
      this.select.showPicker?.()
    })
    this.input.addEventListener('keydown', (event) => this.keydown(event))
    this.select.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        this.cancel()
      }
    })
    this.dom.addEventListener('focusin', (event) => {
      if (!this.dom.contains(event.relatedTarget)) this.initialText = this.node.attrs.text
    })
    this.dom.addEventListener('focusout', (event) => {
      if (this.dom.contains(event.relatedTarget)) return
      // Left empty: a tag just inserted gives back the text it replaced,
      // another is removed.
      if (!this.input.value.trim() && !this.options.cancelInsert?.(this.view, this.getPos(), false)) this.remove()
      this.options.endInsert?.()
    })
  }

  // The tag's value and unit into the fields.
  show(node) {
    const length = parseLength(node.attrs.text)
    this.input.value = length ? length.written : node.attrs.text.replace(/\s*[a-z']+\s*$/i, '').trim()
    const unit = length?.unit || node.attrs.text.trim().split(/\s+/).at(-1)
    this.select.value = LENGTH_UNITS[unit] ? unit : 'm'
    this.unitText.textContent = this.select.value
    this.fit()
  }

  fit() {
    this.input.style.width = `${Math.max(2, this.input.value.length + 0.5)}ch`
  }

  write() {
    this.unitText.textContent = this.select.value
    const text = `${this.input.value.trim()} ${this.select.value}`
    const pos = this.getPos()
    if (pos == null || text === this.node.attrs.text) return
    this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, null, { text }))
  }

  keydown(event) {
    const { selectionStart, selectionEnd, value } = this.input
    if (event.key === 'Escape') {
      event.preventDefault()
      this.cancel()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      this.leave(1)
    } else if (event.key === 'ArrowRight' && selectionStart === value.length && selectionEnd === value.length) {
      event.preventDefault()
      this.select.focus()
    } else if (event.key === 'ArrowLeft' && selectionStart === 0 && selectionEnd === 0) {
      event.preventDefault()
      this.leave(-1)
    } else if (event.key === 'Backspace' && !value) {
      event.preventDefault()
      this.remove()
    }
  }

  cancel() {
    if (this.options.cancelInsert?.(this.view, this.getPos())) return
    const pos = this.getPos()
    if (pos != null && this.initialText != null && this.initialText !== this.node.attrs.text) {
      this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, null, { text: this.initialText }))
      this.show(this.node)
    }
    this.leave(1)
  }

  // The cursor back in the text, after (1) or before (-1) the chip.
  leave(side) {
    const pos = this.getPos()
    if (pos == null) return
    if (!this.input.value.trim()) return this.remove()
    const { state } = this.view
    this.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, side > 0 ? pos + this.node.nodeSize : pos)))
    this.view.focus()
  }

  remove() {
    const pos = this.getPos()
    if (pos == null || this.view.state.doc.nodeAt(pos) !== this.node) return
    this.view.dispatch(this.view.state.tr.delete(pos, pos + this.node.nodeSize))
    this.view.focus()
  }

  update(node) {
    if (node.type !== this.node.type) return false
    this.node = node
    // Not while it's being edited: the fields are what the tag came from.
    if (!this.dom.contains(document.activeElement)) this.show(node)
    return true
  }

  // Selected from the text (the arrows, a click): edit its value.
  selectNode() {
    this.dom.classList.add('ProseMirror-selectednode')
    if (this.view.hasFocus()) this.focus()
  }

  deselectNode() {
    this.dom.classList.remove('ProseMirror-selectednode')
  }

  focus() {
    this.input.focus()
    this.input.select()
  }

  // The fields handle their own events and DOM changes.
  stopEvent(event) {
    return event.target === this.input || event.target === this.select || event.target === this.unitText
  }

  ignoreMutation() {
    return true
  }
}

// A length typed by hand ("Drive 200 m" and a space or punctuation) becomes a
// tag as the next character is typed; Backspace right after gives the text
// back (MarkdownField: undoInputRule). The number stays as written, the unit
// becomes its symbol. Not in code, and not "in" or "mi", common words.
const TYPED_LENGTH = new RegExp(`(?:^|[^\\w.,])((?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?)\\s?(${TEXT_SPELLINGS})([\\s.,;:!?)])$`, 'i')

export const lengthInputRule = $inputRule((ctx) =>
  new InputRule(TYPED_LENGTH, (state, match, start, end) => {
    const [whole, number, spelling, after] = match
    const length = parseLength(`${number} ${spelling}`)
    const type = state.schema.nodes.length_directive
    if (!length || !type) return null
    // The match may start with the character before the number.
    const from = start + whole.indexOf(number)
    const tr = state.tr.replaceWith(from, end, type.create({ text: `${number} ${length.unit}` }))
    return tr.insertText(after, from + 1)
  }),
)

/**
 * The plugins.
 *
 * @param {{value: string, unit: string}} labels - The fields' accessible names.
 * @param {object} [options]
 * @param {(view: EditorView, pos: number, focus?: boolean) => boolean} [options.cancelInsert] - Escape in (or an empty) tag - undo its insertion if it
 *   was just inserted (true), or not (false).
 * @param {() => void} [options.endInsert] - The chip left.
 * @returns {Array}
 */
export function milkdownLength(labels, options = {}) {
  const lengthView = $view(lengthSchema.node, () => (node, view, getPos) => new LengthView(node, view, getPos, labels, options))
  return [lengthRemark, lengthSchema, lengthView, lengthInputRule].flat()
}

/**
 * The chip's editor at a position (after inserting a tag): focus its value.
 *
 * @param {EditorView} view
 * @param {number} pos
 */
export function focusLength(view, pos) {
  const dom = view.nodeDOM(pos)
  dom?.querySelector?.('.oc-length-chip--value')?.focus()
}
