import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Divider, IconButton, Menu, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import {
  ArrowDropDownRounded,
  CodeRounded,
  DataObjectRounded,
  FormatBoldRounded,
  FormatItalicRounded,
  FormatListBulletedRounded,
  FormatListNumberedRounded,
  FormatQuoteRounded,
  FormatStrikethroughRounded,
  HorizontalRuleRounded,
  TitleRounded,
  Redo,
  Undo,
} from '@mui/icons-material'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand, wrapInHeadingCommand, wrapInBulletListCommand, wrapInOrderedListCommand, wrapInBlockquoteCommand, insertHrCommand } from '@milkdown/preset-commonmark'
import { gfm, toggleStrikethroughCommand } from '@milkdown/preset-gfm'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { history, undoCommand, redoCommand } from '@milkdown/plugin-history'
import { clipboard } from '@milkdown/plugin-clipboard'
import { callCommand, replaceAll } from '@milkdown/utils'
import './MarkdownField.scss'

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

const TOOLBAR_BUTTONS_AFTER_HEADINGS = [
  { key: 'quote', icon: FormatQuoteRounded, command: wrapInBlockquoteCommand },
  { key: 'divider2' },
  { key: 'bulletList', icon: FormatListBulletedRounded, command: wrapInBulletListCommand },
  { key: 'orderedList', icon: FormatListNumberedRounded, command: wrapInOrderedListCommand },
  { key: 'hr', icon: HorizontalRuleRounded, command: insertHrCommand },
  { key: 'divider3' },
  { key: 'undo', icon: Undo, command: undoCommand },
  { key: 'redo', icon: Redo, command: redoCommand },
]

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
export default function MarkdownField({ label, value, onChange, minRows = 3, resizable = false, placeholder = '' }) {
  const { t } = useTranslation('markdownField')
  const rootRef = useRef(null)
  const editorRef = useRef(null)
  const lastEmittedRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const [isEmpty, setIsEmpty] = useState(!value)
  const [sourceMode, setSourceMode] = useState(false)
  const [headingMenuAnchor, setHeadingMenuAnchor] = useState(null)
  onChangeRef.current = onChange

  useEffect(() => {
    let cancelled = false

    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, rootRef.current)
        ctx.set(defaultValueCtx, value || '')
        ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
          lastEmittedRef.current = markdown
          setIsEmpty(!markdown)
          onChangeRef.current?.({ target: { value: markdown } })
        })
      })
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(history)
      .use(clipboard)

    editor.create().then(() => {
      if (cancelled) {
        editor.destroy()
        return
      }
      editorRef.current = editor
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
    }
  }, [value])

  function runCommand(command, payload) {
    editorRef.current?.action(callCommand(command.key, payload))
  }

  function runHeadingCommand(level) {
    runCommand(wrapInHeadingCommand, level)
    setHeadingMenuAnchor(null)
  }

  return (
    <Box className="oc-markdown-field">
      <Typography variant="subtitle2" color="text.secondary" component="div" sx={{ mt: '0.5rem', mb: 0.5, fontWeight: 'normal' }}>
        {label}
      </Typography>

      <Box className="oc-markdown-field--toolbar" sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.25, mb: 0.5 }}>
        {TOOLBAR_BUTTONS_BEFORE_HEADINGS.map(({ key, icon: Icon, command, payload }) => (
          <Tooltip key={key} title={t(`toolbar.${key}`)}>
            <span>
              <IconButton size="small" disabled={sourceMode} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand(command, payload)}>
                <Icon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ))}

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

        <Tooltip title={t('toolbar.heading')}>
          <span>
            <IconButton
              size="small"
              disabled={sourceMode}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => setHeadingMenuAnchor(e.currentTarget)}
            >
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
            <Tooltip key={key} title={t(`toolbar.${key}`)}>
              <span>
                <IconButton size="small" disabled={sourceMode} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand(command, payload)}>
                  <Icon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          ),
        )}
        <Box sx={{ flex: 1 }} />
        <Tooltip title={sourceMode ? t('toolbar.viewFormatted') : t('toolbar.viewSource')}>
          <IconButton size="small" color={sourceMode ? 'primary' : 'default'} onClick={() => setSourceMode((v) => !v)}>
            <CodeRounded fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {sourceMode && <TextField fullWidth multiline minRows={minRows} value={value} onChange={onChange} sx={resizable ? { '& textarea': { resize: 'vertical' } } : undefined} />}

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
          <Typography className="oc-markdown-field--placeholder" color="text.disabled">
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
