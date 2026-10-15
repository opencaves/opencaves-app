import { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Alert, Box, Button, ButtonBase, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, FormHelperText, LinearProgress, MenuItem, Tab, Tabs, TextField, Typography } from '@mui/material'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'
import UploadFileRounded from '@mui/icons-material/UploadFileRounded'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'
import AuthorsField from '@/components/MapsPicker/AuthorsField.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import { useCaveData } from '@/hooks/useCaveData.js'
import documentsModel from '@/models/DocumentModel.js'
import { DOCUMENTS_COLLECTION } from '@/config/collections.js'
import { DOCUMENT_CONTENT_TYPE, DOCUMENT_MAX_BYTES, DOCUMENT_PUBLISHED_IN_MAX, DOCUMENT_SUMMARY_MAX, DOCUMENT_TITLE_MAX, DOCUMENT_URL_MAX } from '@/config/documents.js'
import { contentLanguageOf, linkDetails, readPdfDetails, withCrossref } from '@/utils/documentMetadata.js'
import { findDoi, inlineDisposition } from '@/utils/documents.js'
import { loadFirebase } from '@/utils/loadFirebase.js'
import { assertOnline } from '@/utils/assertOnline.js'
import { toContentLanguage } from '@/utils/lang.js'
import { track } from '@/utils/track.js'

const EMPTY = { title: '', authors: [], year: '', publishedIn: '', language: '', summary: '', doi: '' }

// The form's values from a document (editing it).
// A document saved before has its summary as `description`.
const detailsOf = (document) => ({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((key) => [key, document?.[key] ?? (key === 'summary' ? document?.description : undefined) ?? EMPTY[key]])) })

const isWebUrl = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol) && value.length <= DOCUMENT_URL_MAX
  } catch {
    return false
  }
}

// A size in MB, in the app's language ("1.2", "1,2").
const megabytes = (bytes, language) => (bytes / (1024 * 1024)).toLocaleString(language, { maximumFractionDigits: 1 })

/**
 * The fields as saved: trimmed, the empty ones left out (a new document) or
 * removed (editing one: `remove`, Firestore's deleteField()).
 *
 * @param {typeof EMPTY} details
 * @param {'file'|'link'} kind - A link has no `publishedIn` (its site is its address).
 * @param {(() => unknown)|null} remove
 * @returns {Record<string, unknown>}
 */
function savedFields(details, kind, remove) {
  const authors = details.authors.map((author) => author.trim()).filter(Boolean)
  const fields = {
    title: details.title.trim(),
    authors: authors.length > 0 ? authors : undefined,
    year: details.year.trim() || undefined,
    // Where a PDF appeared; a link's site is its address.
    publishedIn: kind === 'file' ? details.publishedIn.trim() || undefined : undefined,
    language: details.language || undefined,
    summary: details.summary.trim() || undefined,
    // The summary's older name, gone once edited.
    description: undefined,
    doi: findDoi(details.doi) || undefined,
  }
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value === undefined && remove && !(key === 'publishedIn' && kind !== 'file') ? remove() : value]).filter(([, value]) => value !== undefined))
}

/**
 * Adding a Further reading item to a cave or a system - or editing one: a
 * dialog (full screen on phones) with two tabs, Upload a PDF (picked or
 * dropped, 20 MB at most, its uploader confirming they may share it) and
 * Paste a link; then its details, filled from the file (pdf.js), the page
 * (the linkMetadata function) and Crossref when they give a DOI - each
 * reviewed before it's saved. A PDF's record is made first (`checking`), its
 * file uploaded to documents/{id}.pdf, then checked by the server
 * (onDocumentUploaded); a link's is saved with the record's list in one
 * write (offline too). Saving stays on the page, confirmed by a snackbar.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {{collection: 'caves'|'sistemas', id: string}} props.holder - The record it's added to.
 * @param {CaveDocument|null} [props.document] - Editing it (no tabs: what it is stays).
 * @param {string[]} [props.authorNames] - The authors already named, suggested.
 */
export default function DocumentDialog({ open, onClose, holder, document = null, authorNames }) {
  const { t, i18n } = useTranslation('furtherReading')
  const [openSnackbar] = useSnackbar()
  const settleWrite = useSettleWrite()
  const isSmall = useSmall()
  const { languages } = useCaveData()
  const uid = useSelector((/** @type {RootState} */ state) => state.session.user?.uid ?? null)
  const editing = Boolean(document)
  const [tab, setTab] = useState(/** @type {'file'|'link'} */ ('file'))
  const kind = editing ? document.kind : tab
  const [details, setDetails] = useState(EMPTY)
  const [url, setUrl] = useState('')
  const [file, setFile] = useState(/** @type {File|null} */ (null))
  const [rights, setRights] = useState(false)
  const [reading, setReading] = useState(false)
  const [found, setFound] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)
  // The details the person typed: never replaced by those found later.
  const touched = useRef(new Set())
  // The last address read (a paste, then a blur, read it once).
  const readUrl = useRef('')
  // The values now, for the details found after a wait (fill).
  const detailsRef = useRef(details)
  detailsRef.current = details
  // The document edited, as it was when the dialog opened: a change to it
  // meanwhile (its list's snapshot) doesn't reset the form.
  const documentRef = useRef(document)
  documentRef.current = document

  const codes = useMemo(() => languages.map((language) => language.code), [languages])
  const languageKey = toContentLanguage(i18n.resolvedLanguage)

  useEffect(() => {
    if (!open) return
    const edited = documentRef.current
    setDetails(detailsOf(edited))
    setUrl(edited?.kind === 'link' ? edited.url || '' : '')
    setTab('file')
    setFile(null)
    setRights(false)
    setReading(false)
    setFound(false)
    setError('')
    setProgress(0)
    touched.current = new Set()
    readUrl.current = ''
  }, [open, document?.id])

  const setField = (key, value) => {
    touched.current.add(key)
    setDetails((current) => ({ ...current, [key]: value }))
  }

  // The details found, in the fields the person hasn't filled.
  function fill(values) {
    const next = {
      title: values.title || '',
      authors: values.authors || [],
      year: values.year || '',
      // A PDF's only: a link's site is its address.
      publishedIn: kind === 'file' ? values.publishedIn || '' : '',
      language: contentLanguageOf(values.language, codes),
      doi: values.doi || '',
    }
    const current = detailsRef.current
    const merged = { ...current }
    let filled = false
    for (const [key, value] of Object.entries(next)) {
      const empty = Array.isArray(current[key]) ? current[key].length === 0 : !current[key]
      if (!touched.current.has(key) && empty && (Array.isArray(value) ? value.length > 0 : value)) {
        merged[key] = value
        filled = true
      }
    }
    if (!filled) return
    setDetails(merged)
    setFound(true)
  }

  async function pickFile(picked) {
    setError('')
    if (!picked) return
    if (picked.type !== DOCUMENT_CONTENT_TYPE && !/\.pdf$/i.test(picked.name)) return setError(t('errors.notPdf'))
    if (picked.size > DOCUMENT_MAX_BYTES) return setError(t('errors.tooLarge', { size: megabytes(DOCUMENT_MAX_BYTES, i18n.language) }))
    setFile(picked)
    setReading(true)
    try {
      fill(await withCrossref(await readPdfDetails(picked)))
    } catch (cause) {
      // Not read here: the server says whether it's a PDF it takes.
      console.warn('[furtherReading] could not read the PDF', cause)
    } finally {
      setReading(false)
    }
  }

  async function readLink(value) {
    const address = value.trim()
    if (!isWebUrl(address) || readUrl.current === address) return
    readUrl.current = address
    setError('')
    setReading(true)
    try {
      // A DOI's link (doi.org): Crossref knows it; any other page is read by the server.
      const doi = /^https?:\/\/(dx\.)?doi\.org\//i.test(address) ? findDoi(decodeURIComponent(address)) : null
      fill(await withCrossref(doi ? { doi } : await linkDetails(address)))
    } catch (cause) {
      console.warn('[furtherReading] could not read the page', cause)
      setError(t('errors.linkUnread'))
    } finally {
      setReading(false)
    }
  }

  const titleMissing = !details.title.trim()
  const yearInvalid = Boolean(details.year) && !/^\d{4}$/.test(details.year.trim())
  const urlInvalid = kind === 'link' && !isWebUrl(url.trim())
  const fileMissing = !editing && kind === 'file' && (!file || !rights)
  const canSave = !saving && !titleMissing && !yearInvalid && !urlInvalid && !fileMissing

  async function save() {
    setSaving(true)
    setError('')
    try {
      const firebase = await loadFirebase()
      if (editing) {
        const fields = savedFields(details, document.kind, firebase.deleteField)
        if (document.kind === 'link') fields.url = url.trim()
        const status = await settleWrite(documentsModel.save(document.id, fields), { name: details.title.trim() })
        if (status === 'saved') openSnackbar(t('saved'), { severity: 'success' })
        onClose()
        return
      }

      const id = pushId()
      const { db, doc, writeBatch, arrayUnion } = firebase
      const fields = savedFields(details, kind, null)
      const fullPath = `${DOCUMENTS_COLLECTION}/${id}.pdf`
      const record = kind === 'link'
        ? { kind: 'link', url: url.trim(), ...fields, userId: uid }
        : { kind: 'file', fullPath, contentType: DOCUMENT_CONTENT_TYPE, status: 'checking', rightsConfirmed: true, ...fields, userId: uid }
      // The document and its place in the record's list, in one write.
      const batch = writeBatch(db)
      batch.set(doc(db, DOCUMENTS_COLLECTION, id), record)
      batch.update(doc(db, holder.collection, holder.id), { documents: arrayUnion(id) })
      track('add_media', { content_type: 'document', document_kind: kind, [holder.collection === 'caves' ? 'cave_id' : 'sistema_id']: holder.id })

      if (kind === 'link') {
        const status = await settleWrite(batch.commit(), { name: details.title.trim() })
        if (status === 'saved') openSnackbar(t('added'), { severity: 'success' })
        onClose()
        return
      }

      assertOnline()
      await batch.commit()
      await uploadFile(firebase, id, fullPath)
      openSnackbar(t('uploaded'), { severity: 'success' })
      onClose()
    } catch (cause) {
      console.error(cause)
      setError(cause?.code === 'offline' ? cause.message : t('errors.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  // The PDF sent to Storage, then its download link saved on its record. A
  // failed upload takes its record back off (its uploader may delete it while
  // it's `checking`: firestore.rules).
  async function uploadFile(firebase, id, fullPath) {
    const { storage, ref, uploadBytesResumable, getDownloadURL } = await firebase.getStorageService()
    const storageRef = ref(storage, fullPath)
    try {
      // Inline: its link opens it in the browser's PDF viewer, not as a download.
      const task = uploadBytesResumable(storageRef, file, { contentType: DOCUMENT_CONTENT_TYPE, contentDisposition: inlineDisposition(details.title) })
      await new Promise((resolve, reject) => {
        task.on('state_changed', (snapshot) => setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)), reject, () => resolve(undefined))
      })
    } catch (cause) {
      const { db, doc, writeBatch, arrayRemove } = firebase
      const batch = writeBatch(db)
      batch.delete(doc(db, DOCUMENTS_COLLECTION, id))
      batch.update(doc(db, holder.collection, holder.id), { documents: arrayRemove(id) })
      await batch.commit().catch((cleanupError) => console.error(cleanupError))
      throw cause
    }
    // Gone already when the server refused it: its record says why.
    try {
      await documentsModel.save(id, { url: await getDownloadURL(storageRef) })
    } catch (cause) {
      console.warn('[furtherReading] no download link', cause)
    }
  }

  function close() {
    if (!saving) onClose()
  }

  const hasFiles = (event) => [...(event.dataTransfer?.types || [])].includes('Files')
  const languageName = (language) => language[languageKey] || language.eng || language.code

  return (
    <Dialog className="oc-document-dialog" open={open} onClose={close} fullScreen={isSmall} fullWidth maxWidth="sm" aria-labelledby="oc-document-dialog-title">
      <DialogTitle id="oc-document-dialog-title" sx={{ pr: 7 }}>
        {editing ? t('editTitle') : t('addTitle')}
      </DialogTitle>
      <DialogCloseButton onClick={close} disabled={saving} />
      {!editing && (
        <Tabs
          className="oc-document-dialog--tabs"
          value={tab}
          onChange={(_, next) => {
            setTab(next)
            setError('')
          }}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="file" label={t('tabs.file')} disabled={saving} />
          <Tab value="link" label={t('tabs.link')} disabled={saving} />
        </Tabs>
      )}
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '20px !important' }}>
        {kind === 'file' && !editing && (
          <>
            {file ? (
              <Box className="oc-document-dialog--file" sx={(theme) => ({ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2, bgcolor: theme.vars.sys.color.surfaceContainerHigh })}>
                <PictureAsPdfRounded color="primary" />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography noWrap sx={{ fontWeight: 500 }}>
                    {file.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t('fileSize', { size: megabytes(file.size, i18n.language) })}
                  </Typography>
                </Box>
                <Button onClick={() => fileInputRef.current?.click()} disabled={saving || reading}>
                  {t('changeFile')}
                </Button>
              </Box>
            ) : (
              // The picker, and a drop target for a PDF.
              <ButtonBase
                className="oc-document-dialog--drop"
                data-drag-over={dragOver || undefined}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => {
                  if (!hasFiles(event)) return
                  event.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(/** @type {Node} */ (event.relatedTarget))) setDragOver(false)
                }}
                onDrop={(event) => {
                  if (!hasFiles(event)) return
                  event.preventDefault()
                  setDragOver(false)
                  pickFile(event.dataTransfer.files[0])
                }}
                sx={(theme) => ({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  py: 4,
                  px: 2,
                  borderRadius: 3,
                  border: `1px dashed ${theme.vars.sys.color.outline}`,
                  color: theme.vars.palette.text.secondary,
                  textAlign: 'center',
                  '&:hover, &[data-drag-over]': { bgcolor: theme.vars.palette.action.hover, borderColor: theme.vars.palette.primary.main },
                  '&.Mui-focusVisible': { outline: `3px solid ${theme.vars.palette.primary.main}`, outlineOffset: 2 },
                })}
              >
                <UploadFileRounded sx={{ fontSize: 40, color: 'primary.main' }} />
                <Typography component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>
                  {t('pickFile')}
                </Typography>
                <Typography component="span" variant="body2">
                  {t('pickFileHint', { size: megabytes(DOCUMENT_MAX_BYTES, i18n.language) })}
                </Typography>
              </ButtonBase>
            )}
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="application/pdf,.pdf"
              onChange={(event) => {
                const picked = event.target.files?.[0]
                event.target.value = ''
                pickFile(picked)
              }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('preferLink')}
            </Typography>
          </>
        )}

        {kind === 'link' && (
          <TextField
            className="oc-document-dialog--url"
            label={t('fields.url')}
            placeholder="https://"
            type="url"
            required
            fullWidth
            autoFocus={!editing}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onBlur={() => !editing && readLink(url)}
            onPaste={(event) => {
              if (editing) return
              const pasted = event.clipboardData.getData('text')
              // Read once the field has it.
              setTimeout(() => readLink(pasted))
            }}
            error={Boolean(url) && urlInvalid}
            helperText={Boolean(url) && urlInvalid ? t('errors.url') : t('fields.urlHint')}
            slotProps={{ htmlInput: { maxLength: DOCUMENT_URL_MAX } }}
          />
        )}

        {reading && (
          <Box className="oc-document-dialog--reading" role="status">
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              {kind === 'file' ? t('readingFile') : t('readingLink')}
            </Typography>
            <LinearProgress />
          </Box>
        )}
        {found && !reading && (
          <Alert className="oc-document-dialog--found" severity="info" variant="outlined">
            {t('found')}
          </Alert>
        )}

        <TextField label={t('fields.title')} required fullWidth multiline value={details.title} onChange={(event) => setField('title', event.target.value)} slotProps={{ htmlInput: { maxLength: DOCUMENT_TITLE_MAX } }} />
        <AuthorsField value={details.authors} onChange={(authors) => setField('authors', authors)} names={authorNames} helperText={t('fields.authorsHint')} />
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          <TextField
            label={t('fields.year')}
            size="small"
            value={details.year}
            onChange={(event) => setField('year', event.target.value.replace(/\D/g, '').slice(0, 4))}
            error={yearInvalid}
            helperText={yearInvalid ? t('errors.year') : ' '}
            slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 4 } }}
            sx={{ width: { sm: 120 }, flexShrink: 0 }}
          />
          {kind === 'file' && <TextField label={t('fields.publishedIn')} size="small" fullWidth value={details.publishedIn} onChange={(event) => setField('publishedIn', event.target.value)} helperText={t('fields.publishedInHint')} slotProps={{ htmlInput: { maxLength: DOCUMENT_PUBLISHED_IN_MAX } }} />}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          <TextField select label={t('fields.language')} size="small" value={details.language} onChange={(event) => setField('language', event.target.value)} sx={{ minWidth: 200 }}>
            <MenuItem value="">
              <em>{t('fields.noLanguage')}</em>
            </MenuItem>
            {/* Keeps a language the list doesn't have (yet). */}
            {details.language && !codes.includes(details.language) && <MenuItem value={details.language}>{details.language}</MenuItem>}
            {languages.map((language) => (
              <MenuItem key={language.code} value={language.code}>
                {languageName(language)}
              </MenuItem>
            ))}
          </TextField>
          <TextField label={t('fields.doi')} size="small" fullWidth value={details.doi} onChange={(event) => setField('doi', event.target.value.trim())} placeholder="10.1234/…" helperText={t('fields.doiHint')} slotProps={{ htmlInput: { maxLength: 300 } }} />
        </Box>
        <TextField
          label={t('fields.summary')}
          fullWidth
          multiline
          minRows={4}
          value={details.summary}
          onChange={(event) => setField('summary', event.target.value)}
          helperText={`${details.summary.length} / ${DOCUMENT_SUMMARY_MAX}`}
          slotProps={{ htmlInput: { maxLength: DOCUMENT_SUMMARY_MAX }, formHelperText: { sx: { textAlign: 'right' } } }}
          sx={{ '& textarea': { resize: 'vertical' } }}
        />

        {kind === 'file' && !editing && (
          <Box className="oc-document-dialog--rights">
            <FormControlLabel control={<Checkbox checked={rights} onChange={(event) => setRights(event.target.checked)} />} label={t('rights')} />
            <FormHelperText sx={{ ml: 4 }}>{t('rightsHint')}</FormHelperText>
          </Box>
        )}

        {saving && kind === 'file' && !editing && (
          <Box role="status">
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              {t('uploading', { progress })}
            </Typography>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
        )}
        {error && (
          <Alert className="oc-document-dialog--error" severity="error">
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={saving}>
          {t('cancel')}
        </Button>
        <Button variant="contained" disableElevation onClick={save} disabled={!canSave} startIcon={saving ? <CircularProgress size={16} /> : undefined}>
          {editing ? t('save') : t('add')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
