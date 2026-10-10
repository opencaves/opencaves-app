import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'

/**
 * Tracks an edit form's unsaved changes against a baseline (the values it
 * was loaded or last saved with), and guards leaving while there are some:
 * in-app navigations get a Save / Discard / Keep editing dialog, closing or
 * reloading the tab the browser's own prompt.
 *
 * The baseline also lives in a ref, updated synchronously: a form that
 * navigates right after saving or deleting (in the same tick, before
 * re-rendering) must not be blocked by its own navigation.
 *
 * @param {object} form
 * @param {object} [options]
 * @param {object} [options.initial] - The baseline, for forms whose values are ready on first render;
 *   the others call setBaseline() once loaded. No baseline = no changes.
 * @param {(options: {leaving: boolean}) => *} [options.onSave] - The form's save, for the dialog's Save. It counts as saved once
 *   it has called setBaseline() (so a failed or refused save stays put).
 * @param {boolean} [options.canSave=true] - Whether the form is currently valid enough to save.
 * @param {string} [options.within] - The page's address - moving under it (e.g. its galleries, over
 *   the form, which stays) isn't leaving.
 * @returns {{isDirty: boolean, setBaseline: (value: object) => void, discardChanges: () => void, unsavedChangesDialog: React.ReactNode}}
 */
export function useUnsavedChanges(form, { initial, onSave, canSave = true, within } = {}) {
  const { t } = useTranslation('app', { keyPrefix: 'unsavedChanges' })
  const [baseline, setBaselineState] = useState(() => (initial === undefined ? null : JSON.stringify(initial)))
  const baselineRef = useRef(baseline)
  const formRef = useRef(form)
  formRef.current = form
  const [savingFromDialog, setSavingFromDialog] = useState(false)

  const isDirty = baseline !== null && JSON.stringify(form) !== baseline

  const setBaseline = useCallback((value) => {
    const json = JSON.stringify(value)
    baselineRef.current = json
    setBaselineState(json)
  }, [])

  // Accepts the current values as they are, e.g. right before leaving after
  // a delete.
  const discardChanges = useCallback(() => setBaseline(formRef.current), [setBaseline])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const dirty = baselineRef.current !== null && JSON.stringify(formRef.current) !== baselineRef.current
    // Only leaving the page counts, not e.g. a hash or search change, nor
    // moving under its address (within).
    const inside = (path) => Boolean(within) && (path === within || path.startsWith(`${within}/`))
    return dirty && currentLocation.pathname !== nextLocation.pathname && !(inside(currentLocation.pathname) && inside(nextLocation.pathname))
  })

  useEffect(() => {
    if (!isDirty) {
      return undefined
    }
    function onBeforeUnload(event) {
      event.preventDefault()
      // Still needed by some browsers to show the prompt.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  async function saveAndLeave() {
    setSavingFromDialog(true)
    try {
      await onSave({ leaving: true })
    } catch (error) {
      console.error(error)
    } finally {
      setSavingFromDialog(false)
    }
    const stillDirty = JSON.stringify(formRef.current) !== baselineRef.current
    if (stillDirty) {
      blocker.reset?.()
    } else {
      blocker.proceed?.()
    }
  }

  const dialog = (
    <Dialog className="oc-unsaved-changes-dialog" open={blocker.state === 'blocked'} onClose={() => !savingFromDialog && blocker.reset?.()} aria-labelledby="oc-unsaved-changes-title" aria-describedby="oc-unsaved-changes-text">
      {/* The app's rule: an X on every dialog. */}
      <DialogCloseButton onClick={() => blocker.reset?.()} disabled={savingFromDialog} />
      <DialogTitle id="oc-unsaved-changes-title" sx={{ pr: 7 }}>{t('title')}</DialogTitle>
      <DialogContent>
        <DialogContentText id="oc-unsaved-changes-text">{t('message')}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={() => blocker.proceed?.()} disabled={savingFromDialog} sx={{ mr: 'auto' }}>
          {t('discard')}
        </Button>
        <Button onClick={() => blocker.reset?.()} disabled={savingFromDialog}>
          {t('stay')}
        </Button>
        {onSave && (
          <Button variant="contained" onClick={saveAndLeave} disabled={savingFromDialog || !canSave}>
            {t('save')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )

  return { isDirty, setBaseline, discardChanges, unsavedChangesDialog: dialog }
}
