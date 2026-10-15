import { useState } from 'react'
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

/**
 * Further reading's items: each its icon (a PDF, a link), its title opening
 * it in a new tab, its line ({@link citationLine}) and description; a PDF its
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
        {/* M3 list item's leading icon, on its tonal container. */}
        <Box
          aria-hidden="true"
          sx={(theme) => ({ width: 40, height: 40, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: theme.vars.sys.color.secondaryContainer, color: theme.vars.sys.color.onSecondaryContainer })}
        >
          {document.kind === 'file' ? <PictureAsPdfRounded fontSize="small" /> : <LinkRounded fontSize="small" />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {href ? (
            <Link
              className="oc-further-reading--title"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              onClick={() => track('select_content', { content_type: 'document', item_id: document.id })}
              sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}
            >
              {document.title}
            </Link>
          ) : (
            <Typography className="oc-further-reading--title" sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
              {document.title}
            </Typography>
          )}
          {line && (
            <Typography variant="body2" className="oc-further-reading--line" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
              {line}
            </Typography>
          )}
          {document.description && (
            <Typography variant="body2" className="oc-further-reading--description" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>
              {document.description}
            </Typography>
          )}
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
