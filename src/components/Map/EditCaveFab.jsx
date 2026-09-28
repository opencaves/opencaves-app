import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { SpeedDial, SpeedDialAction, SpeedDialIcon, speedDialActionClasses } from '@mui/material'
import { AddRounded, EditRounded } from '@mui/icons-material'

// Sits directly above the map's "find my location" control (bottom-right,
// same margin from the edge) - only shown to editors, since both actions
// lead to editor-only /caves/*/edit routes. Kept below the mobile result
// pane's own z-index so it gets covered the same way the geolocate button
// does when that pane is open, instead of floating on top of it.
export default function EditCaveFab() {
  const { caveId } = useParams()
  const navigate = useNavigate()
  const roles = useSelector((state) => state.session.roles)
  const [open, setOpen] = useState(false)
  const { t } = useTranslation('map', { keyPrefix: 'editFab' })

  if (!roles.includes('editor')) {
    return null
  }

  function editCave() {
    setOpen(false)
    navigate(`/map/${caveId}/edit`)
  }

  function addNewCave() {
    setOpen(false)
    navigate(`/caves/${pushId()}/edit`)
  }

  return (
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
        bottom: `calc(16px + 50px + ${theme.spacing(2)})`,
        zIndex: 'var(--oc-app-menu-z-index)',
        // Plain one-line text beside each action instead of MUI's default
        // wrapping label chip. With no chip behind it, it gets the same
        // light-text-with-dark-halo treatment as the map's marker labels
        // (Marker.scss) so it stays readable over any part of the map.
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
      <SpeedDialAction icon={<EditRounded />} onClick={editCave} slotProps={{ tooltip: { title: t('editCave'), open: true }, fab: { 'aria-label': t('editCave'), disabled: !caveId } }} />
      <SpeedDialAction icon={<AddRounded />} onClick={addNewCave} slotProps={{ tooltip: { title: t('addNewCave'), open: true }, fab: { 'aria-label': t('addNewCave') } }} />
    </SpeedDial>
  )
}
