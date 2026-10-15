import { useCallback, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Link, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material'
import DeleteForeverRounded from '@mui/icons-material/DeleteForeverRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import EditRounded from '@mui/icons-material/EditRounded'
import LinkRounded from '@mui/icons-material/LinkRounded'
import MoreVertRounded from '@mui/icons-material/MoreVertRounded'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'
import Message from '@/components/Message.jsx'
import Reorderable from '@/components/Reorder/Reorderable.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { downloadName, useMediaActionsFor, withOthers } from '@/components/MediaPane/menuItems/mediaActions.jsx'
import documentsModel from '@/models/DocumentModel.js'
import { DOCUMENTS_COLLECTION } from '@/config/collections.js'
import { documentHref } from '@/utils/documents.js'
import { loadFirebase } from '@/utils/loadFirebase.js'
import { track } from '@/utils/track.js'

// Authors named in a document's line before "et al.".
const AUTHORS_SHOWN = 3

// Kept from a sortable item around it (a press would start a drag, a
// Ctrl+Shift+Arrow move the item) - as CardOptionsMenu.
const keepFromItem = (event) => event.stopPropagation()

/**
 * A document's ⋮ menu: its actions (MediaAction's shape, from
 * mediaActions.jsx and the list's own).
 *
 * @param {object} props
 * @param {string} props.ariaLabel
 * @param {{key?: string, label: string, icon: import('react').ReactNode, onClick: () => void, danger?: boolean, divider?: boolean}[]} props.actions
 */
function DocumentMenu({ ariaLabel, actions }) {
  const [anchorEl, setAnchorEl] = useState(null)
  return (
    <>
      <IconButton
        className="oc-further-reading--menu"
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={anchorEl ? 'true' : undefined}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        onMouseDown={keepFromItem}
        onTouchStart={keepFromItem}
        onKeyDown={keepFromItem}
        sx={{ flexShrink: 0, mt: -0.5, mr: -1 }}
      >
        <MoreVertRounded />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} onMouseDown={keepFromItem} onTouchStart={keepFromItem}>
        {actions.map((action) => (
          <MenuItem
            key={action.key || action.label}
            divider={action.divider}
            onClick={() => {
              setAnchorEl(null)
              // Off the menu first: a dialog opened by the action takes the focus.
              const focused = /** @type {HTMLElement} */ (document.activeElement)
              focused?.blur()
              action.onClick()
            }}
            sx={action.danger ? { color: 'error.main', '& .MuiListItemIcon-root': { color: 'error.main' } } : undefined}
          >
            <ListItemIcon>{action.icon}</ListItemIcon>
            <ListItemText>{action.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

/**
 * A document's line under its title: its authors (the first few, then "et
 * al."), its year, and where it is - a PDF: where it appeared (its
 * `publishedIn`: a journal, a book, a website); a link: its site's domain,
 * from its address ("nationalgeographic.com", without "www.").
 *
 * @param {CaveDocument} document
 * @param {(key: string, options?: object) => string} t
 * @returns {string}
 */
function citationLine(document, t) {
  const authors = Array.isArray(document.authors) ? document.authors : []
  const named = authors.length > AUTHORS_SHOWN ? `${authors.slice(0, AUTHORS_SHOWN).join(', ')} ${t('etAl')}` : authors.join(', ')
  let where = document.kind === 'file' ? document.publishedIn : null
  if (document.kind === 'link') {
    try {
      where = new URL(document.url).hostname.replace(/^www\./, '')
    } catch {
      where = null
    }
  }
  return [named, document.year, where].filter(Boolean).join(' · ')
}

/**
 * Before a document goes to the trash (admins): out of every cave and system
 * listing it, until an admin restores it (Audits > Trash). The owner renders
 * `dialog`.
 *
 * @returns {{requestTrash: (document: CaveDocument) => void, dialog: import('react').ReactNode}}
 */
function useTrashDocumentConfirm() {
  const { t } = useTranslation('furtherReading')
  const [openSnackbar] = useSnackbar()
  const [pending, setPending] = useState(null)
  const [trashing, setTrashing] = useState(false)

  const close = () => !trashing && setPending(null)
  async function confirm() {
    setTrashing(true)
    try {
      await documentsModel.moveToTrash(pending.id)
      track('remove_media', { content_type: 'document', item_id: pending.id })
      openSnackbar(t('trashed'), { severity: 'success' })
    } catch (error) {
      console.error(error)
      openSnackbar(<Message message={t('trashFailed')} type="error" />, { autoHide: false })
    } finally {
      setTrashing(false)
      setPending(null)
    }
  }

  const dialog = (
    <Dialog className="oc-further-reading--trash-dialog" open={Boolean(pending)} onClose={close}>
      <DialogTitle sx={{ pr: 7 }}>{t('trashTitle')}</DialogTitle>
      <DialogCloseButton onClick={close} disabled={trashing} />
      <DialogContent>
        <DialogContentText>{t('trashConfirm', { title: pending?.title || '' })}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={trashing}>
          {t('cancel')}
        </Button>
        <Button color="error" onClick={confirm} disabled={trashing}>
          {t('trash')}
        </Button>
      </DialogActions>
    </Dialog>
  )
  return { requestTrash: setPending, dialog }
}

// A summary's lines shown before More.
const SUMMARY_LINES = 3
// A document's cover, an A4 page's proportions: a PDF's first page, else
// one set in type (DocumentCover).
const COVER_WIDTH = 56
const COVER_SX = (theme) => ({ width: COVER_WIDTH, aspectRatio: '1 / 1.414', flexShrink: 0, borderRadius: 1, outline: `1px solid ${theme.vars.sys.color.outlineVariant}` })
// A typeset cover's band: one of these by its site's name (each site its own,
// the same on every page), in the theme's colours.
const BAND_COLORS = ['primary.main', 'secondary.main', 'info.main', 'success.main', 'warning.main']

/**
 * A short name for a site, from its address: the name under its top-level
 * domain (science.org: science; onlinelibrary.wiley.com: wiley).
 *
 * @param {string} [url]
 * @returns {string}
 */
function siteName(url) {
  try {
    const labels = new URL(url).hostname.replace(/^www\./, '').split('.')
    return labels.length >= 2 ? labels[labels.length - 2] : labels[0]
  } catch {
    return ''
  }
}

/**
 * A document's cover, beside its title: a PDF's first page (drawn by the
 * server), else one set in type - a band in its source's colour
 * ({@link BAND_COLORS}), the source (a link's site, {@link siteName}; a
 * PDF's journal), the year, and a link's or a PDF's icon.
 *
 * @param {object} props
 * @param {CaveDocument} props.document
 */
function DocumentCover({ document }) {
  if (document.coverUrl) {
    return <Box component="img" className="oc-further-reading--cover" src={document.coverUrl} alt="" loading="lazy" crossOrigin="anonymous" sx={(theme) => ({ ...COVER_SX(theme), objectFit: 'cover', objectPosition: 'top', bgcolor: '#ffffff' })} />
  }
  const source = document.kind === 'link' ? siteName(document.url) : document.publishedIn || 'PDF'
  const band = BAND_COLORS[[...source].reduce((sum, char) => sum + char.charCodeAt(0), 0) % BAND_COLORS.length]
  const Icon = document.kind === 'link' ? LinkRounded : PictureAsPdfRounded
  return (
    <Box
      aria-hidden="true"
      className="oc-further-reading--cover oc-further-reading--cover-typeset"
      sx={(theme) => ({ ...COVER_SX(theme), display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: theme.vars.sys.color.surfaceContainerHighest, color: 'text.secondary' })}
    >
      <Box sx={{ height: 6, flexShrink: 0, bgcolor: band }} />
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', px: 0.5, pt: 0.5, pb: 0.25 }}>
        <Box sx={{ fontSize: 8, lineHeight: 1.15, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{source}</Box>
        <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Box sx={{ fontSize: 12, fontWeight: 700, color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>{document.year}</Box>
          <Icon sx={{ fontSize: 12 }} />
        </Box>
      </Box>
    </Box>
  )
}

/**
 * A document's summary: its first lines ({@link SUMMARY_LINES}), and a More
 * button that shows the rest - when there's more.
 *
 * @param {object} props
 * @param {string} props.text
 */
function DocumentSummary({ text }) {
  const { t } = useTranslation('furtherReading')
  const [open, setOpen] = useState(false)
  const [clipped, setClipped] = useState(false)
  // Clipped or not: measured once laid out, and again as its width changes
  // (a ref callback's cleanup, React 19).
  const measure = useCallback((/** @type {HTMLElement|null} */ element) => {
    if (!element) return
    const check = () => setClipped(element.scrollHeight > element.clientHeight + 1)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return (
    <Box className="oc-further-reading--summary" sx={{ mt: 0.5 }}>
      <Typography
        ref={open ? undefined : measure}
        variant="body2"
        sx={{ whiteSpace: 'pre-line', ...(!open && { display: '-webkit-box', WebkitLineClamp: SUMMARY_LINES, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}
      >
        {text}
      </Typography>
      {(clipped || open) && (
        <Button size="small" onClick={() => setOpen(!open)} aria-expanded={open} sx={{ ml: -1, mt: 0.25 }}>
          {t(open ? 'summaryLess' : 'summaryMore')}
        </Button>
      )}
    </Box>
  )
}

/**
 * Further reading's items: each its cover ({@link DocumentCover}), its title opening
 * it in a new tab, its line ({@link citationLine}) and summary ({@link DocumentSummary}); a PDF its
 * uploader sees before it's shown says it's being checked, or why it was
 * refused. Each its ⋮ menu: Share, Download (a PDF) and Report for everyone
 * ({@link useMediaActionsFor}); Edit for editors, Remove (to the trash) for
 * admins, and Remove for good for its uploader when the server refused it.
 * Editors reorder them by drag and drop, each among its own record's
 * ({@link Reorderable}).
 *
 * @param {object} props
 * @param {import('./useFurtherReading.js').FurtherReadingItem[]} props.items
 * @param {(ids: string[]) => void} props.onReorder
 * @param {(id: string) => string} props.groupOf
 * @param {(document: CaveDocument) => void} props.onEdit - An editor's Edit.
 * @param {string} props.pagePath - The page's address (a report's).
 */
export default function FurtherReadingList({ items, onReorder, groupOf, onEdit, pagePath }) {
  const { t } = useTranslation('furtherReading')
  const [openSnackbar] = useSnackbar()
  const roles = useSelector((/** @type {RootState} */ state) => state.session.roles)
  const uid = useSelector((/** @type {RootState} */ state) => state.session.user?.uid ?? null)
  const isEditor = roles.includes('editor')
  const isAdmin = roles.includes('admin')
  const mediaActionsFor = useMediaActionsFor()
  const { requestTrash, dialog: trashDialog } = useTrashDocumentConfirm()
  const byId = new Map(items.map((item) => [item.document.id, item]))

  // A PDF the server refused (or whose upload never finished), deleted for
  // good by its uploader, and taken off its record's list.
  async function removeOwn({ document, holder }) {
    try {
      const { db, doc, writeBatch, arrayRemove } = await loadFirebase()
      const batch = writeBatch(db)
      batch.delete(doc(db, DOCUMENTS_COLLECTION, document.id))
      batch.update(doc(db, holder.collection, holder.id), { documents: arrayRemove(document.id) })
      await batch.commit()
      track('remove_media', { content_type: 'document', item_id: document.id })
      openSnackbar(t('removed'), { severity: 'success' })
    } catch (error) {
      console.error(error)
      openSnackbar(<Message message={t('removeFailed')} type="error" />, { autoHide: false })
    }
  }

  const menuOf = ({ document, holder }) => {
    const href = documentHref(document)
    const shown = document.kind !== 'file' || document.status === 'ready'
    const own = document.kind === 'file' && !shown && Boolean(uid) && document.userId === uid
    const everyone = shown
      ? mediaActionsFor({
          kind: 'document',
          itemId: document.id,
          shareUrl: href || undefined,
          download: document.kind === 'file' && document.url ? { url: document.url, fileName: downloadName('opencaves-document', document.id, document.contentType) } : undefined,
          reportPage: href || `${pagePath}#further-reading`,
        })
      : []
    const others = [
      isEditor && { key: 'edit', label: t('edit'), icon: <EditRounded fontSize="small" />, onClick: () => onEdit(document) },
      isAdmin && { key: 'trash', label: t('trash'), icon: <DeleteForeverRounded fontSize="small" />, onClick: () => requestTrash(document), danger: true },
      own && !isAdmin && { key: 'remove', label: t('remove'), icon: <DeleteOutlineRounded fontSize="small" />, onClick: () => removeOwn({ document, holder }), danger: true },
    ].filter(Boolean)
    return everyone.length ? withOthers(everyone, others) : others
  }

  /** @type {SortableRenderItem} */
  const renderItem = (id, index, sortable) => {
    const { document } = byId.get(id)
    const href = document.kind !== 'file' || document.status === 'ready' ? documentHref(document) : null
    const line = citationLine(document, t)
    const actions = menuOf(byId.get(id))
    return (
      <Box
        component="li"
        key={id}
        className="oc-further-reading--item"
        {...(sortable?.itemProps || {})}
        sx={(theme) => ({
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
          py: 1.5,
          px: 1,
          mx: -1,
          borderRadius: 2,
          bgcolor: sortable?.isDragging ? theme.vars.sys.color.surfaceContainerHigh : 'transparent',
          boxShadow: sortable?.isDragging ? 3 : 'none',
          '& + &': { borderTop: `1px solid ${theme.vars.sys.color.outlineVariant}` },
        })}
      >
        <DocumentCover document={document} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {href ? (
            <Link
              className="oc-further-reading--title"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              onClick={() => track('select_content', { content_type: 'document', item_id: document.id })}
              sx={{ fontWeight: 500, overflowWrap: 'break-word' }}
            >
              {document.title}
            </Link>
          ) : (
            <Typography className="oc-further-reading--title" sx={{ fontWeight: 500, overflowWrap: 'break-word' }}>
              {document.title}
            </Typography>
          )}
          {line && (
            <Typography variant="body2" className="oc-further-reading--line" sx={{ color: 'text.secondary', overflowWrap: 'break-word' }}>
              {line}
            </Typography>
          )}
          {/* `description`: its older name, on documents saved before. */}
          {(document.summary || document.description) && <DocumentSummary text={document.summary || document.description} />}
          {document.kind === 'file' && document.status === 'checking' && (
            <Chip className="oc-further-reading--status" size="small" icon={<CircularProgress size={12} />} label={t('checking')} sx={{ mt: 1 }} />
          )}
          {document.kind === 'file' && document.status === 'rejected' && (
            <Chip className="oc-further-reading--status" size="small" color="error" variant="outlined" label={t(`rejected.${document.rejectReason || 'unreadable'}`)} sx={{ mt: 1, height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } }} />
          )}
        </Box>
        {actions.length > 0 && <DocumentMenu ariaLabel={t('options', { title: document.title })} actions={actions} />}
      </Box>
    )
  }

  return (
    <>
      <Reorderable
        enabled={isEditor && items.length > 1}
        ids={items.map(({ document }) => document.id)}
        onReorder={onReorder}
        groupOf={groupOf}
        strategy="vertical"
        renderItem={renderItem}
        wrap={(children) => (
          <Box component="ul" className="oc-further-reading--list" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {children}
          </Box>
        )}
      />
      {trashDialog}
    </>
  )
}
