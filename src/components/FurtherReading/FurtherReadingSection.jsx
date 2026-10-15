import { Suspense, lazy, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Box, ListItemButton, ListItemIcon, ListItemText } from '@mui/material'
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded'
import MenuBookRounded from '@mui/icons-material/MenuBookRounded'
import AddButton from '@/components/AddButton.jsx'
import IndexSection from '@/components/IndexPage/IndexSection.jsx'
import EmptySectionText from '@/components/IndexPage/EmptySectionText.jsx'
import { useRequireLogin } from '@/hooks/useRequireLogin.jsx'
import FurtherReadingList from './FurtherReadingList.jsx'
import { useFurtherReading } from './useFurtherReading.js'

// The add and edit dialog (and its PDF reading), loaded once opened.
const DocumentDialog = lazy(() => import('./DocumentDialog.jsx'))

/**
 * Further reading: the papers, reports, books and web pages about a cave or
 * a cave system ({@link useFurtherReading}: a cave's own, then its
 * systems'), as a list ({@link FurtherReadingList}), with Add for editors
 * (the others are asked to sign in first) opening {@link DocumentDialog}.
 * On a page (`page`): a section of its own (#further-reading), after the
 * maps - shown with nothing yet too, saying so. In the map's pane (`pane`):
 * one row, its count, opening Further reading's own pane (FurtherReadingPane,
 * ./reading) - shown when there's something, or to editors. In that pane
 * (`panel`): the list and Add, the pane giving the title.
 *
 * @param {object} props
 * @param {Cave|null} [props.cave] - A cave's page or pane: the cave (its documents are added to it).
 * @param {string} [props.sistemaId] - The cave's system, or the system page's (its documents are added to it).
 * @param {Sistema[]} props.sistemas
 * @param {Connection[]} props.connections
 * @param {string} props.pagePath - The page's address (reports).
 * @param {CaveDocument[]} [props.pageDocuments] - Every document, from the page that waited for them.
 * @param {'page'|'pane'|'panel'} [props.variant='page']
 */
export default function FurtherReadingSection({ cave = null, sistemaId, sistemas, connections, pagePath, pageDocuments, variant = 'page' }) {
  const { t } = useTranslation('furtherReading')
  const isEditor = useSelector((/** @type {RootState} */ state) => state.session.roles).includes('editor')
  const requireLogin = useRequireLogin('documents')
  const { items, loading, reorder, groupOf } = useFurtherReading({ cave, sistemaId, sistemas, connections, pageDocuments })
  // The dialog: { document } to edit one, {} to add one, null closed.
  const [dialog, setDialog] = useState(/** @type {{document?: CaveDocument}|null} */ (null))
  const holder = cave ? { collection: /** @type {const} */ ('caves'), id: cave.id } : { collection: /** @type {const} */ ('sistemas'), id: sistemaId }
  // The authors already named, suggested in the form.
  const authorNames = useMemo(() => [...new Set(items.flatMap(({ document }) => document.authors || []))], [items])

  if (loading || !holder.id) return null
  if (variant === 'pane' && items.length === 0 && !isEditor) return null

  const list = items.length > 0 && <FurtherReadingList items={items} onReorder={reorder} groupOf={groupOf} onEdit={(document) => setDialog({ document })} pagePath={pagePath} />
  const add = (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <AddButton className="oc-further-reading--add" onClick={() => (isEditor ? setDialog({}) : requireLogin())}>
        {t('addButton')}
      </AddButton>
    </Box>
  )
  const dialogs = dialog && (
    <Suspense fallback={null}>
      <DocumentDialog open onClose={() => setDialog(null)} holder={holder} document={dialog.document || null} authorNames={authorNames} />
    </Suspense>
  )

  if (variant === 'pane') {
    // One row: the list would outweigh the rest of the pane (a cave with
    // fourteen papers). Relative: /map/<id>/reading.
    return (
      <Box component="section" className="oc-details-section oc-further-reading oc-further-reading--pane">
        <ListItemButton component={Link} to="reading" state={{ fromPane: true }} className="oc-further-reading--open" sx={{ px: 'var(--oc-pane-padding-inline, 16px)', py: 1.5 }}>
          <ListItemIcon sx={{ minWidth: 40, color: 'primary.main' }}>
            <MenuBookRounded />
          </ListItemIcon>
          <ListItemText primary={t('title')} secondary={items.length > 0 ? t('paneCount', { count: items.length }) : t('paneEmpty')} slotProps={{ primary: { sx: { fontWeight: 500 } } }} />
          <ChevronRightRounded sx={{ color: 'text.secondary' }} />
        </ListItemButton>
      </Box>
    )
  }

  if (variant === 'panel') {
    return (
      <Box className="oc-further-reading oc-further-reading--panel" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.length === 0 && <EmptySectionText>{t('empty')}</EmptySectionText>}
        {list}
        {add}
        {dialogs}
      </Box>
    )
  }

  return (
    <IndexSection id="further-reading" title={t('title')} count={items.length || undefined} className="oc-further-reading" card>
      {items.length === 0 && <EmptySectionText>{t('empty')}</EmptySectionText>}
      {list}
      {add}
      {dialogs}
    </IndexSection>
  )
}
