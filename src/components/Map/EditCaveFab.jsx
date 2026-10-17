import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Box, ClickAwayListener, SpeedDial, SpeedDialAction, SpeedDialIcon } from '@mui/material'
import AddRounded from '@mui/icons-material/AddRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import EditOffRounded from '@mui/icons-material/EditOffRounded'
import EditRounded from '@mui/icons-material/EditRounded'
import { MEASURE_BUTTON_SLOT } from '@/config/map.js'
import './EditCaveFab.scss'

// Sits directly above the map's "find my location" control (bottom-right,
// same margin from the edge) - only shown to editors, since both actions
// lead to editor-only /caves/*/edit routes. Like that control, it rides
// above the mobile result pane's sheet and fades out once the sheet is
// mostly open (ResultPaneSm's --oc-result-pane-sm-height and
// --oc-map-controls-* variables).

/**
 * The editor actions, shared with the mobile result pane's header
 * (EditCaveButtons), which offers them when this FAB is hidden.
 *
 * @returns {{canEdit: boolean, caveId: string, isEditingCave: boolean, editCave: () => void, exitEditMode: () => void, addNewCave: () => void}}
 */
export function useEditCaveActions() {
  const { caveId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const roles = useSelector((/** @type {RootState} */ state) => state.session.roles)

  return {
    canEdit: roles.includes('editor'),
    caveId,
    // Already editing it: "Edit cave" has nothing to do.
    isEditingCave: !!caveId && location.pathname === `/map/${caveId}/edit`,
    editCave: () => navigate(`/map/${caveId}/edit`),
    // Same one-way exit as the form's Cancel (replace: no edit-mode entry
    // left in history for Back to reopen); unsaved changes are dropped.
    exitEditMode: () => navigate(`/map/${caveId}`, { replace: true }),
    addNewCave: () => navigate(`/caves/${pushId()}/edit`),
  }
}

export default function EditCaveFab() {
  const { canEdit, caveId, isEditingCave, editCave: goEditCave, exitEditMode: goExitEditMode, addNewCave: goAddNewCave } = useEditCaveActions()
  const [open, setOpen] = useState(false)
  const { t } = useTranslation('map', { keyPrefix: 'editFab' })
  const dialRef = useRef(null)

  // Opened by a click (or Enter/Space) on its button only - not by hovering
  // or focusing it, MUI's default.
  function openDial(_event, reason) {
    if (reason === 'toggle') setOpen(true)
  }

  // Closed by its button, Escape, the focus leaving it or a click outside
  // (closeOutside) - not by the pointer leaving it.
  function closeDial(_event, reason) {
    if (reason !== 'mouseLeave') setOpen(false)
  }

  // A click outside it: Safari doesn't focus a clicked button, so no blur
  // closes it there.
  function closeOutside() {
    setOpen(false)
  }

  // The height its open actions take above it, for what sits over it (the
  // cave layer's legend, CaveLayerLegend): --oc-edit-fab-actions-height.
  useEffect(() => {
    const actions = dialRef.current?.querySelector('.MuiSpeedDial-actions')
    const height = open && actions ? actions.scrollHeight : 0
    document.documentElement.style.setProperty('--oc-edit-fab-actions-height', `${height}px`)
    return () => document.documentElement.style.setProperty('--oc-edit-fab-actions-height', '0px')
  }, [open])

  if (!canEdit) {
    return null
  }

  function editCave() {
    setOpen(false)
    goEditCave()
  }

  function exitEditMode() {
    setOpen(false)
    goExitEditMode()
  }

  function addNewCave() {
    setOpen(false)
    goAddNewCave()
  }

  // An action's slots: its label beside it (MUI's "static tooltip") takes the
  // same click as its button - unless disabled. Their classes are
  // EditCaveFab.scss's.
  const actionSlots = (label, onClick, disabled = false) => ({
    tooltip: { title: label, open: true },
    staticTooltip: { className: 'oc-edit-cave-fab--item' },
    fab: { 'aria-label': label, disabled, className: 'oc-edit-cave-fab--action' },
    staticTooltipLabel: disabled ? {} : { onClick, className: 'oc-edit-cave-fab--label' },
  })
  // The disabled label too: its look is the same, dimmed.
  const labelClass = { className: 'oc-edit-cave-fab--label' }

  // Its own labeled section: on the map page it sits outside the map's region
  // and any other landmark.
  return (
    <ClickAwayListener onClickAway={closeOutside} mouseEvent={open ? 'onClick' : false} touchEvent={open ? 'onTouchEnd' : false}>
    <Box component="section" className="oc-edit-cave-fab--section" aria-label={t('ariaLabel')}>
    <SpeedDial
      ref={dialRef}
      className={['oc-edit-cave-fab', isEditingCave && 'oc-edit-cave-fab--editing', open && 'oc-edit-cave-fab--open'].filter(Boolean).join(' ')}
      ariaLabel={t('ariaLabel')}
      icon={<SpeedDialIcon icon={<EditRounded />} openIcon={<CloseRounded />} />}
      open={open}
      onOpen={openDial}
      onClose={closeDial}
      FabProps={{ className: 'oc-edit-cave-fab--button' }}
      // The ruler button's room under it (config/map.js), for its offset.
      style={{ '--oc-measure-button-slot': `calc(${MEASURE_BUTTON_SLOT})` }}
    >
      {/* tooltip.open makes MUI render each action's title as a fixed label
          to the left of its icon (its "static tooltip") instead of a hover
          tooltip. */}
      {/* While editing this cave, the action becomes its opposite. */}
      {isEditingCave ? (
        <SpeedDialAction icon={<EditOffRounded />} onClick={exitEditMode} slotProps={actionSlots(t('exitEditMode'), exitEditMode)} />
      ) : (
        <SpeedDialAction icon={<EditRounded />} onClick={editCave} slotProps={{ ...actionSlots(caveId ? t('editCave') : t('editCaveNoneSelected'), editCave, !caveId), ...(!caveId && { staticTooltipLabel: labelClass }) }} />
      )}
      <SpeedDialAction icon={<AddRounded />} onClick={addNewCave} slotProps={actionSlots(t('addNewCave'), addNewCave)} />
    </SpeedDial>
    </Box>
    </ClickAwayListener>
  )
}
