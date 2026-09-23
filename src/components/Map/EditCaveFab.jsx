import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from '@mui/material'
import { AddLocationRounded, EditLocationRounded, EditRounded } from '@mui/icons-material'

// Sits directly above the map's "find my location" control (bottom-right,
// same margin from the edge) - only shown to editors, since both actions
// lead to editor-only /caves/*/edit routes. Kept below the mobile result
// pane's own z-index so it gets covered the same way the geolocate button
// does when that pane is open, instead of floating on top of it.
export default function EditCaveFab() {
  const { caveId } = useParams()
  const navigate = useNavigate()
  const roles = useSelector(state => state.session.roles)
  const [open, setOpen] = useState(false)
  const { t } = useTranslation('map', { keyPrefix: 'editFab' })

  if (!roles.includes('editor')) {
    return null
  }

  function editCurrentCave() {
    setOpen(false)
    navigate(`/caves/${caveId}/edit`)
  }

  function addNewCave() {
    setOpen(false)
    navigate(`/caves/${pushId()}/edit`)
  }

  return (
    <SpeedDial
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
      })}
    >
      <SpeedDialAction
        icon={<EditLocationRounded />}
        title={t('editCurrentCave')}
        onClick={editCurrentCave}
        slotProps={{ fab: { 'aria-label': t('editCurrentCave'), disabled: !caveId } }}
      />
      <SpeedDialAction
        icon={<AddLocationRounded />}
        title={t('addNewCave')}
        onClick={addNewCave}
        slotProps={{ fab: { 'aria-label': t('addNewCave') } }}
      />
    </SpeedDial>
  )
}
