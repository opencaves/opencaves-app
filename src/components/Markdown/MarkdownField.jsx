import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, Dialog, DialogActions, DialogContent, Divider, IconButton, Menu, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ArrowDropDownRounded from '@mui/icons-material/ArrowDropDownRounded'
import StraightenRounded from '@mui/icons-material/StraightenRounded'
import CodeRounded from '@mui/icons-material/CodeRounded'
import DataObjectRounded from '@mui/icons-material/DataObjectRounded'
import FormatBoldRounded from '@mui/icons-material/FormatBoldRounded'
import FormatItalicRounded from '@mui/icons-material/FormatItalicRounded'
import FormatListBulletedRounded from '@mui/icons-material/FormatListBulletedRounded'
import FormatListNumberedRounded from '@mui/icons-material/FormatListNumberedRounded'
import FormatQuoteRounded from '@mui/icons-material/FormatQuoteRounded'
import FormatStrikethroughRounded from '@mui/icons-material/FormatStrikethroughRounded'
import HorizontalRuleRounded from '@mui/icons-material/HorizontalRuleRounded'
import LinkRounded from '@mui/icons-material/LinkRounded'
import TitleRounded from '@mui/icons-material/TitleRounded'
import Redo from '@mui/icons-material/Redo'
import Undo from '@mui/icons-material/Undo'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, editorViewOptionsCtx } from '@milkdown/core'
import { TextSelection } from '@milkdown/prose/state'
import { undoInputRule } from '@milkdown/prose/inputrules'
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand, wrapInHeadingCommand, wrapInBulletListCommand, wrapInOrderedListCommand, wrapInBlockquoteCommand, insertHrCommand } from '@milkdown/preset-commonmark'
import { gfm, toggleStrikethroughCommand } from '@milkdown/preset-gfm'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { history, undoCommand, redoCommand } from '@milkdown/plugin-history'
import { clipboard } from '@milkdown/plugin-clipboard'
import { callCommand, replaceAll, getMarkdown } from '@milkdown/utils'
import CaveLinkDialog from './CaveLinkDialog.jsx'
import { focusLength, milkdownLength } from './milkdownLength.js'
import { findLength } from './lengthDirective.js'
import './MarkdownField.scss'

const CAVE_LINK_PREFIX = 'oc:'

// The formatting toolbar. Each entry's command is one of Milkdown's own
// command/mark/node plugins (see the imports above) - adding a button for a
// new markdown convention later just means adding its command here, same as
// these were.
const TOOLBAR_BUTTONS_BEFORE_HEADINGS = [
  { key: 'bold', icon: FormatBoldRounded, command: toggleStrongCommand },
  { key: 'italic', icon: FormatItalicRounded, command: toggleEmphasisCommand },
  { key: 'strikethrough', icon: FormatStrikethroughRounded, command: toggleStrikethroughCommand },
  { key: 'inlineCode', icon: DataObjectRounded, command: toggleInlineCodeCommand },
]

const TOOLBAR_BUTTONS_AFTER_HEADINGS = [{ key: 'quote', icon: FormatQuoteRounded, command: wrapInBlockquoteCommand }, { key: 'divider2' }, { key: 'bulletList', icon: FormatListBulletedRounded, command: wrapInBulletListCommand }, { key: 'orderedList', icon: FormatListNumberedRounded, command: wrapInOrderedListCommand }, { key: 'hr', icon: HorizontalRuleRounded, command: insertHrCommand }, { key: 'divider3' }, { key: 'undo', icon: Undo, command: undoCommand }, { key: 'redo', icon: Redo, command: redoCommand }]

const HEADING_LEVELS = [1, 2, 3]

// A WYSIWYG markdown editor (Milkdown: ProseMirror for editing, backed by
// remark/micromark for markdown parsing) in place of the previous
// Markdown/Preview tabbed textarea - typing renders formatting live instead
// of showing raw ** and # syntax. A toolbar covers the common formatting
// actions, and a "view source" toggle swaps in a plain textarea bound to
// the exact same markdown string for anyone who wants to edit the raw text
// directly - both edit the same value, so switching between them mid-edit
// just works.
//
// Built directly on Milkdown's core + commonmark/gfm presets rather than its
// batteries-included @milkdown/crepe editor: Crepe pulls in its optional
// features (AI, LaTeX, CodeMirror, image embedding) as static imports, not
// behind its runtime on/off config, so using it roughly doubled this app's
// bundle even with everything but the base editor turned off. This stack
// only bundles what's actually used, and stays open to growing later - a
// new markdown convention becomes a Milkdown plugin (a node/mark spec, a
// remark syntax extension, or a preset like the two already used below)
// passed to another .use() call, same as commonmark/gfm are here.
//
// onChange keeps the exact (event) => event.target.value contract every
// call site already used with the old textarea, so no caller needed to
// change when this was rewritten.
export default function MarkdownField({ label, value, onChange, minRows = 3, resizable = false, placeholder = '', labelProps = {} }) {
  const { t } = useTranslation('markdownField')
  const theme = useTheme()
  const rootRef = useRef(null)
  const editorRef = useRef(null)
  const lastEmittedRef = useRef(value)
  // The text the editor was loaded with, and the editor's own serialization
  // of it: the editor rewrites markdown its own way (spacing, escaping, list
  // markers...), so without this an edit that's then undone would come back
  // as different text - leaving the form "changed" (its Save enabled).
  const sourceValueRef = useRef(value || '')
  const sourceMarkdownRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const [isEmpty, setIsEmpty] = useState(!value)
  const [sourceMode, setSourceMode] = useState(false)
  const labelId = useId()
  const [headingMenuAnchor, setHeadingMenuAnchor] = useState(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkHref, setLinkHref] = useState('')
  const [linkText, setLinkText] = useState('')
  const [linkMenuAnchor, setLinkMenuAnchor] = useState(null)
  const [caveLinkDialogOpen, setCaveLinkDialogOpen] = useState(false)
  // href of the link under the cursor/selection when the link menu opened.
  const [activeHref, setActiveHref] = useState('')
  // Focusing the dialog's text field moves the browser's DOM selection out
  // of the editor, which Milkdown/ProseMirror then reads back as "selection
  // cleared" - snapshot the selected range here, while the editor still has
  // focus, and restore it before applying the link.
  const savedSelectionRef = useRef(null)
  // The tag the Length button just inserted, while it's being typed in.
  const lengthInsertRef = useRef(null)
  onChangeRef.current = onChange

  useEffect(() => {
    let cancelled = false

    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, rootRef.current)
        ctx.set(defaultValueCtx, value || '')
        // The editable element is a bare contenteditable: name it after the
        // field's visible label so it reads as a labeled text box.
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-labelledby': labelId },
          // Backspace right after a typed length became a tag (milkdownLength.js'
          // input rule): the text as typed.
          handleKeyDown: (view, event) => event.key === 'Backspace' && undoInputRule(view.state, view.dispatch),
        }))
        ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
          // Back to the loaded document: report the original text as is.
          const emitted = markdown === sourceMarkdownRef.current ? sourceValueRef.current : markdown
          lastEmittedRef.current = emitted
          setIsEmpty(!emitted)
          onChangeRef.current?.({ target: { value: emitted } })
        })
      })
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(history)
      .use(clipboard)
      // The `:length[45 m]` tag (milkdownLength.js), edited in place.
      .use(milkdownLength({ value: t('toolbar.lengthValue'), unit: t('toolbar.lengthUnit') }, { cancelInsert: (view, pos, focus) => cancelLengthInsert(view, pos, focus), endInsert: () => (lengthInsertRef.current = null) }))

    editor.create().then(() => {
      if (cancelled) {
        editor.destroy()
        return
      }
      editorRef.current = editor
      sourceMarkdownRef.current = editor.action(getMarkdown())
    })

    return () => {
      cancelled = true
      editorRef.current?.destroy()
      editorRef.current = null
    }
    // Only ever built once per mount - see the effect below for syncing
    // later value changes (e.g. switching between edited entities, or
    // typing in the source-mode textarea) back in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (editorRef.current && value !== lastEmittedRef.current) {
      lastEmittedRef.current = value
      setIsEmpty(!value)
      editorRef.current.action(replaceAll(value || ''))
      // A new document from outside (another entity, the source-mode
      // textarea, a reload after saving): the new baseline to map back to.
      sourceValueRef.current = value || ''
      sourceMarkdownRef.current = editorRef.current.action(getMarkdown())
    }
  }, [value])

  function runCommand(command, payload) {
    editorRef.current?.action(callCommand(command.key, payload))
  }

  function runHeadingCommand(level) {
    runCommand(wrapInHeadingCommand, level)
    setHeadingMenuAnchor(null)
  }

  // Existing href at the cursor (empty selection, using the marks active
  // for insertion there) or anywhere within the selected range, so editing
  // a link the cursor/selection is already inside pre-fills its URL
  // instead of starting from a blank field.
  function getActiveLinkHref(view) {
    const linkType = view.state.schema.marks.link
    if (!linkType) {
      return ''
    }

    const { from, to, empty, $from } = view.state.selection
    if (empty) {
      return $from.marks().find((mark) => mark.type === linkType)?.attrs?.href || ''
    }

    let href = ''
    view.state.doc.nodesBetween(from, to, (node) => {
      const mark = node.marks.find((m) => m.type === linkType)
      if (mark) {
        href = mark.attrs.href
      }
    })
    return href
  }

  // The whole link (same href) around a cursor inside it: its range in the
  // document, so editing it changes all of it.
  function linkRangeAt(state, linkType) {
    const { $from } = state.selection
    const href = $from.marks().find((m) => m.type === linkType)?.attrs.href
    if (!href) {
      return null
    }
    const hasLink = (node) => node.marks.some((m) => m.type === linkType && m.attrs.href === href)
    const parent = $from.parent
    let pos = $from.start()
    let from = null
    let to = null
    let found = false
    for (let i = 0; i < parent.childCount; i++) {
      const child = parent.child(i)
      const childFrom = pos
      pos += child.nodeSize
      if (hasLink(child)) {
        if (from === null) from = childFrom
        to = pos
        if ($from.pos >= childFrom && $from.pos <= pos) found = true
      } else if (found) {
        break
      } else {
        from = null
      }
    }
    return found ? { from, to } : null
  }

  // The link button offers a web link or a link to a cave. The selection and
  // any existing link are captured here, before the menu takes focus. A
  // cursor inside a link selects the whole link, so the dialog edits it (its
  // URL and its text) instead of adding a link within it.
  function openLinkMenu(event) {
    const view = editorRef.current?.ctx.get(editorViewCtx)
    if (view) {
      const { state } = view
      const linkType = state.schema.marks.link
      const range = state.selection.empty && linkType ? linkRangeAt(state, linkType) : null
      const { from, to } = range || state.selection
      savedSelectionRef.current = { from, to }
      setLinkText(state.doc.textBetween(from, to, ' '))
    } else {
      savedSelectionRef.current = null
      setLinkText('')
    }
    setActiveHref(view ? getActiveLinkHref(view) : '')
    setLinkMenuAnchor(event.currentTarget)
  }

  function insertLink() {
    setLinkMenuAnchor(null)
    setLinkHref(activeHref.startsWith(CAVE_LINK_PREFIX) ? '' : activeHref)
    setLinkDialogOpen(true)
  }

  function insertCaveLink() {
    setLinkMenuAnchor(null)
    setCaveLinkDialogOpen(true)
  }

  // Puts the selection captured by openLinkMenu back, since the dialog moved
  // focus (and so ProseMirror's selection) out of the editor.
  function restoreSelection(view) {
    if (!savedSelectionRef.current) {
      return
    }
    const docSize = view.state.doc.content.size
    const from = Math.min(savedSelectionRef.current.from, docSize)
    const to = Math.min(savedSelectionRef.current.to, docSize)
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)))
    view.focus()
  }

  // The Length button: a tag (`:length[45 m]`, milkdownLength.js) at the
  // cursor, its value ready to type. With text selected ("200 meters!"), the
  // length found in it becomes the tag (only it: "!" stays).
  function insertLength() {
    const view = editorRef.current?.ctx.get(editorViewCtx)
    const type = view?.state.schema.nodes.length_directive
    if (!view || !type) {
      return
    }
    const { selection, doc } = view.state
    // Within one paragraph, each character of the text is one position
    // (other inline nodes count as one placeholder character).
    const found = !selection.empty && selection.$from.sameParent(selection.$to) ? findLength(doc.textBetween(selection.from, selection.to, '\n', '￼')) : null
    // Text with no length in it is replaced by an empty tag (Escape, or
    // leaving it empty, gives it back).
    const from = found ? selection.from + found.index : selection.from
    const to = found ? from + found.length : selection.to
    // What Escape puts back (cancelLengthInsert): the text the tag replaced,
    // and the selection.
    lengthInsertRef.current = { pos: from, replaced: doc.slice(from, to), selection: { from: selection.from, to: selection.to } }
    view.dispatch(view.state.tr.replaceWith(from, to, type.create({ text: found ? `${found.written} ${found.unit}` : ' m' })))
    focusLength(view, from)
  }

  // Escape in a tag just inserted by the Length button: the text as it was
  // before, with its selection (and the focus back in the editor, unless it
  // went elsewhere). False for any other tag.
  function cancelLengthInsert(view, pos, focus = true) {
    const insert = lengthInsertRef.current
    lengthInsertRef.current = null
    const node = pos != null && view.state.doc.nodeAt(pos)
    if (!insert || insert.pos !== pos || node?.type.name !== 'length_directive') {
      return false
    }
    const tr = view.state.tr.replace(pos, pos + node.nodeSize, insert.replaced)
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, insert.selection.from, insert.selection.to)))
    if (focus) view.focus()
    return true
  }

  // Written as the same `oc:<caveId>` link the app already renders as an
  // in-app link to that cave (see uri-transformer.js). With nothing
  // selected, the cave's name is inserted as the link text.
  function confirmCaveLink(cave) {
    setCaveLinkDialogOpen(false)
    const view = editorRef.current?.ctx.get(editorViewCtx)
    const linkType = view?.state.schema.marks.link
    if (!view || !linkType) {
      return
    }

    restoreSelection(view)
    const { state } = view
    const { from, to, empty } = state.selection
    const mark = linkType.create({ href: `${CAVE_LINK_PREFIX}${cave.id}` })
    // Replaces any link already on the selection instead of toggling it off,
    // which is what toggleLinkCommand would do there.
    const tr = empty ? state.tr.replaceSelectionWith(state.schema.text(cave.name, [mark]), false) : state.tr.removeMark(from, to, linkType).addMark(from, to, mark)
    view.dispatch(tr)
  }

  function isValidUrl(href) {
    try {
      new URL(href)
      return true
    } catch {
      return false
    }
  }

  // The link's text replaces the selection (the URL itself when left
  // empty), carrying the link.
  function confirmLink() {
    setLinkDialogOpen(false)
    const view = editorRef.current?.ctx.get(editorViewCtx)
    const linkType = view?.state.schema.marks.link
    if (!isValidUrl(linkHref) || !view || !linkType) {
      return
    }

    restoreSelection(view)
    const { state } = view
    const { from, to } = state.selection
    const text = linkText.trim() || linkHref
    const marks = [...state.doc.resolve(from).marks().filter((m) => m.type !== linkType), linkType.create({ href: linkHref })]
    const tr = state.tr.replaceWith(from, to, state.schema.text(text, marks))
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, from + text.length)))
    view.focus()
  }

  return (
    <Box className="oc-markdown-field">
      <Typography id={labelId} variant="subtitle2" color="text.secondary" component="div" sx={{ mt: '0.5rem', mb: 0.5, fontWeight: 'normal' }} {...labelProps}>
        {label}
      </Typography>

      {/* Wraps onto more rows when it doesn't fit (e.g. phones' 48dp touch
          targets, set by the edit form). */}
      {/* Tooltips use describeChild: their child is the <span> that lets a
          disabled button still show one, and a label isn't allowed on a
          plain span - each button carries its own aria-label instead. */}
      <Box className="oc-markdown-field--toolbar" role="toolbar" aria-label={t('toolbar.ariaLabel', { field: label })} sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.25, mb: 0.5 }}>
        {TOOLBAR_BUTTONS_BEFORE_HEADINGS.map(({ key, icon: Icon, command, payload }) => (
          <Tooltip key={key} title={t(`toolbar.${key}`)} describeChild>
            <span>
              <IconButton size="small" aria-label={t(`toolbar.${key}`)} disabled={sourceMode} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand(command, payload)}>
                <Icon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ))}

        <Tooltip title={t('toolbar.link')} describeChild>
          <span>
            <IconButton size="small" aria-label={t('toolbar.link')} aria-haspopup="menu" aria-expanded={linkMenuAnchor ? 'true' : undefined} disabled={sourceMode} onMouseDown={(e) => e.preventDefault()} onClick={openLinkMenu}>
              <LinkRounded fontSize="small" />
              <ArrowDropDownRounded fontSize="small" sx={{ ml: -0.5 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Menu className="oc-markdown-field--link-menu" anchorEl={linkMenuAnchor} open={Boolean(linkMenuAnchor)} onClose={() => setLinkMenuAnchor(null)}>
          <MenuItem onClick={insertLink}>{t('toolbar.linkWeb')}</MenuItem>
          <MenuItem onClick={insertCaveLink}>{t('toolbar.linkCave')}</MenuItem>
        </Menu>

        <Tooltip title={t('toolbar.length')} describeChild>
          <span>
            <IconButton size="small" aria-label={t('toolbar.length')} disabled={sourceMode} onMouseDown={(e) => e.preventDefault()} onClick={insertLength}>
              <StraightenRounded fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

        <Tooltip title={t('toolbar.heading')} describeChild>
          <span>
            <IconButton size="small" aria-label={t('toolbar.heading')} aria-haspopup="menu" aria-expanded={headingMenuAnchor ? 'true' : undefined} disabled={sourceMode} onMouseDown={(e) => e.preventDefault()} onClick={(e) => setHeadingMenuAnchor(e.currentTarget)}>
              <TitleRounded fontSize="small" />
              <ArrowDropDownRounded fontSize="small" sx={{ ml: -0.5 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Menu className="oc-markdown-field--heading-menu" anchorEl={headingMenuAnchor} open={Boolean(headingMenuAnchor)} onClose={() => setHeadingMenuAnchor(null)}>
          {HEADING_LEVELS.map((level) => (
            <MenuItem key={level} onClick={() => runHeadingCommand(level)}>
              {t(`toolbar.heading${level}`)}
            </MenuItem>
          ))}
        </Menu>

        {TOOLBAR_BUTTONS_AFTER_HEADINGS.map(({ key, icon: Icon, command, payload }) =>
          key.startsWith('divider') ? (
            <Divider key={key} orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
          ) : (
            <Tooltip key={key} title={t(`toolbar.${key}`)} describeChild>
              <span>
                <IconButton size="small" aria-label={t(`toolbar.${key}`)} disabled={sourceMode} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand(command, payload)}>
                  <Icon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          ),
        )}
        <Box sx={{ flex: 1 }} />
        <Tooltip title={sourceMode ? t('toolbar.viewFormatted') : t('toolbar.viewSource')}>
          <IconButton size="small" aria-label={t('toolbar.viewSource')} aria-pressed={sourceMode} color={sourceMode ? 'primary' : 'default'} onClick={() => setSourceMode((v) => !v)}>
            <CodeRounded fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogContent>
          <TextField fullWidth label={t('toolbar.linkText')} value={linkText} onChange={(e) => setLinkText(e.target.value)} sx={{ mt: 1, mb: 2 }} />
          <TextField autoFocus fullWidth label={t('toolbar.linkPrompt')} value={linkHref} onChange={(e) => setLinkHref(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && isValidUrl(linkHref) && confirmLink()} placeholder="https://" error={!!linkHref && !isValidUrl(linkHref)} helperText={!!linkHref && !isValidUrl(linkHref) ? t('toolbar.linkInvalid') : ' '} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>{t('toolbar.linkCancel')}</Button>
          <Button variant="contained" onClick={confirmLink} disabled={!isValidUrl(linkHref)}>
            {t('save')}
          </Button>
        </DialogActions>
      </Dialog>

      <CaveLinkDialog open={caveLinkDialogOpen} initialCaveId={activeHref.startsWith(CAVE_LINK_PREFIX) ? activeHref.slice(CAVE_LINK_PREFIX.length) : null} onClose={() => setCaveLinkDialogOpen(false)} onConfirm={confirmCaveLink} />

      {sourceMode && <TextField fullWidth multiline minRows={minRows} value={value} onChange={onChange} slotProps={{ htmlInput: { 'aria-labelledby': labelId } }} sx={{ '& textarea': { ...theme.typography.md3Input, resize: resizable ? 'vertical' : 'none' } }} />}

      {/* Kept mounted (only hidden) rather than conditionally rendered when
          sourceMode is on: Milkdown attaches to this exact DOM node once on
          mount, so removing and re-adding it would orphan the editor - a
          toggle back to WYSIWYG would show an empty box with no editor. */}
      <Box
        className="oc-markdown-field--editor-wrap"
        sx={{
          display: sourceMode ? 'none' : 'flex',
          position: 'relative',
          minHeight: `${(minRows * 1.4375 + 1) * 1.25}em`,
          resize: resizable ? 'vertical' : 'none',
          overflow: resizable ? 'auto' : 'visible',
          '& .ProseMirror': theme.typography.md3Input,
        }}
        onMouseDown={(e) => {
          // Clicking below the last line (ProseMirror only occupies its
          // actual content height, not this wrapper's full min-height)
          // wouldn't otherwise land on the editable element at all. Skipped
          // near the bottom-right corner so it doesn't swallow the native
          // resize-handle drag, which starts with the same mousedown event.
          if (e.target !== e.currentTarget) {
            return
          }
          if (resizable) {
            const rect = e.currentTarget.getBoundingClientRect()
            const nearResizeHandle = e.clientX > rect.right - 16 && e.clientY > rect.bottom - 16
            if (nearResizeHandle) {
              return
            }
          }
          e.preventDefault()
          rootRef.current?.querySelector('.ProseMirror')?.focus()
        }}
      >
        {isEmpty && placeholder && (
          <Typography className="oc-markdown-field--placeholder" variant="md3Placeholder">
            {placeholder}
          </Typography>
        )}
        <Box ref={rootRef} className="oc-markdown-field--editor" />
      </Box>

      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
        {t('hint')}
      </Typography>
    </Box>
  )
}
