import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Box, SpeedDial, SpeedDialAction, SpeedDialIcon, speedDialActionClasses } from '@mui/material'
import { AddRounded, EditOffRounded, EditRounded } from '@mui/icons-material'

// Sits directly above the map's "find my location" control (bottom-right,
// same margin from the edge) - only shown to editors, since both actions
// lead to editor-only /caves/*/edit routes. Like that control, it rides
// above the mobile result pane's sheet and fades out once the sheet is
// mostly open (ResultPaneSm's --oc-result-pane-sm-height and
// --oc-map-controls-* variables).
// The editor actions, shared with the mobile result pane's header
// (EditCaveButtons), which offers them when this FAB is hidden.
export function useEditCaveActions() {
  const { caveId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const roles = useSelector((state) => state.session.roles)

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

  // Its own labeled section: on the map page it sits outside the map's region
  // and any other landmark.
  return (
    <Box component="section" className="oc-edit-cave-fab--section" aria-label={t('ariaLabel')}>
    <SpeedDial
      className="oc-edit-cave-fab"
      ariaLabel={t('ariaLabel')}
      icon={<SpeedDialIcon icon={<EditRounded />} />}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      sx={(theme) => ({
        position: 'absolute',
        // MD3's standard FAB-to-edge margin is 16dp - theme.spacing(2) at
        // this theme's default 8px base unit. Matches the geolocate
        // control's own edge margin (--oc-map-control-edge-margin in
        // Map.scss) so the two align on the same right edge.
        right: theme.spacing(2),
        // The geolocate control is 16px (its own margin) + 50px (height)
        // up from the bottom. Clear it by the same 16dp used for the edge
        // margins - at 8dp the two circular buttons read as cramped/prone
        // to mis-taps rather than a deliberately related, evenly-spaced
        // pair.
        bottom: `calc(var(--oc-result-pane-sm-height, 0px) + 16px + 50px + ${theme.spacing(2)})`,
        opacity: 'var(--oc-map-controls-opacity, 1)',
        visibility: 'var(--oc-map-controls-visibility, visible)',
        transition: 'opacity 150ms ease, visibility 150ms ease',
        zIndex: 'var(--oc-app-menu-z-index)',
        // Plain one-line text beside each action instead of MUI's default
        // wrapping label chip. With no chip behind it, it gets the same
        // light-text-with-dark-halo treatment as the map's marker labels
        // (Marker.scss) so it stays readable over any part of the map.
        // A disabled action (Edit cave, while already editing it) gets a
        // light grey, slightly translucent surface - distinct from the
        // enabled actions' white, but unlike MUI's default near-transparent
        // grey still visible over the map - with a greyed icon, and its
        // label dims with it.
        [`& .${speedDialActionClasses.fab}.Mui-disabled`]: {
          bgcolor: 'rgba(224, 224, 224, 0.85)',
          color: 'action.disabled',
          boxShadow: theme.shadows[2],
        },
        [`& .${speedDialActionClasses.staticTooltip}:has(.Mui-disabled) .${speedDialActionClasses.staticTooltipLabel}`]: {
          opacity: 0.6,
        },
        [`& .${speedDialActionClasses.staticTooltipLabel}`]: {
          bgcolor: 'transparent',
          boxShadow: 'none',
          whiteSpace: 'nowrap',
          color: 'rgb(240, 240, 240)',
          fontWeight: 500,
          textShadow: 'rgb(45, 45, 45) 1px 0px 0px, rgb(45, 45, 45) 0.540302px 0.841471px 0px, rgb(45, 45, 45) -0.416147px 0.909297px 0px, rgb(45, 45, 45) -0.989992px 0.14112px 0px, rgb(45, 45, 45) -0.653644px -0.756802px 0px, rgb(45, 45, 45) 0.283662px -0.958924px 0px, rgb(45, 45, 45) 0.96017px -0.279416px 0px',
        },
      })}
    >
      {/* tooltip.open makes MUI render each action's title as a fixed label
          to the left of its icon (its "static tooltip") instead of a hover
          tooltip. */}
      {/* While editing this cave, the action becomes its opposite. */}
      {isEditingCave ? (
        <SpeedDialAction icon={<EditOffRounded />} onClick={exitEditMode} slotProps={{ tooltip: { title: t('exitEditMode'), open: true }, fab: { 'aria-label': t('exitEditMode') } }} />
      ) : (
        <SpeedDialAction icon={<EditRounded />} onClick={editCave} slotProps={{ tooltip: { title: t('editCave'), open: true }, fab: { 'aria-label': t('editCave'), disabled: !caveId } }} />
      )}
      <SpeedDialAction icon={<AddRounded />} onClick={addNewCave} slotProps={{ tooltip: { title: t('addNewCave'), open: true }, fab: { 'aria-label': t('addNewCave') } }} />
    </SpeedDial>
    </Box>
  )
}
