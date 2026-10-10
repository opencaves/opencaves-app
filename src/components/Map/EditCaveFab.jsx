import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Box, SpeedDial, SpeedDialAction, SpeedDialIcon, speedDialActionClasses } from '@mui/material'
import AddRounded from '@mui/icons-material/AddRounded'
import EditOffRounded from '@mui/icons-material/EditOffRounded'
import EditRounded from '@mui/icons-material/EditRounded'

// Sits directly above the map's "find my location" control (bottom-right,
// same margin from the edge) - only shown to editors, since both actions
// lead to editor-only /caves/*/edit routes. Like that control, it rides
// above the mobile result pane's sheet and fades out once the sheet is
// mostly open (ResultPaneSm's --oc-result-pane-sm-height and
// --oc-map-controls-* variables).
// How long it stays open once the pointer has left it: a path that strays a
// little (towards a label, past the gap between the buttons) doesn't close it.
const CLOSE_DELAY_MS = 500

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
  const dialRef = useRef(null)
  const closeTimer = useRef(null)
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  function openDial() {
    clearTimeout(closeTimer.current)
    setOpen(true)
  }

  // The pointer leaving: closed after CLOSE_DELAY_MS, unless it comes back;
  // a tap on the button, Escape or the keyboard leaving: closed at once.
  function closeDial(_event, reason) {
    clearTimeout(closeTimer.current)
    if (reason === 'mouseLeave') closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
    else setOpen(false)
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
    clearTimeout(closeTimer.current)
    setOpen(false)
    goEditCave()
  }

  function exitEditMode() {
    clearTimeout(closeTimer.current)
    setOpen(false)
    goExitEditMode()
  }

  function addNewCave() {
    clearTimeout(closeTimer.current)
    setOpen(false)
    goAddNewCave()
  }

  // An action's slots: its label beside it (MUI's "static tooltip") takes the
  // same click as its button - unless disabled.
  const actionSlots = (label, onClick, disabled = false) => ({
    tooltip: { title: label, open: true },
    fab: { 'aria-label': label, disabled },
    staticTooltipLabel: disabled ? {} : { onClick, className: 'oc-edit-cave-fab--label' },
  })

  // Its own labeled section: on the map page it sits outside the map's region
  // and any other landmark.
  return (
    <Box component="section" className="oc-edit-cave-fab--section" aria-label={t('ariaLabel')}>
    <SpeedDial
      ref={dialRef}
      className="oc-edit-cave-fab"
      ariaLabel={t('ariaLabel')}
      icon={<SpeedDialIcon icon={<EditRounded />} />}
      open={open}
      onOpen={openDial}
      onClose={closeDial}
      // Back over it - its button, an action or a label - within the delay:
      // it stays open (MUI only calls onOpen when it's closed).
      onMouseEnter={() => clearTimeout(closeTimer.current)}
      sx={(theme) => ({
        position: 'absolute',
        // MD3's FAB-to-edge margin (--oc-map-control-edge-margin, Map.scss:
        // 16dp on phones, 24dp from 600px), as the geolocate control's, so
        // the two align on the same right edge.
        right: 'var(--oc-map-control-edge-margin)',
        // Above the geolocate control (its edge margin + 56px), 16dp apart:
        // MD3's spacing between stacked FABs.
        bottom: `calc(var(--oc-result-pane-sm-height, 0px) + var(--oc-map-control-edge-margin) + 56px + ${theme.spacing(2)})`,
        opacity: 'var(--oc-map-controls-opacity, 1)',
        visibility: 'var(--oc-map-controls-visibility, visible)',
        transition: 'opacity 150ms ease, visibility 150ms ease',
        zIndex: 'var(--oc-app-menu-z-index)',
        // The icon in full text colour: MUI's default grey (text.secondary)
        // looked washed out, dark mode most.
        [`& .${speedDialActionClasses.fab}:not(.Mui-disabled)`]: {
          color: 'text.primary',
        },
        // Each action's label on one line, as plain text with a halo (below),
        // readable over any part of the map.
        // A disabled action (Edit cave, while already editing it) gets a
        // container-tone surface (light or dark grey with the mode) -
        // distinct from the enabled actions' paper, but unlike MUI's default
        // near-transparent grey still visible over the map - with a greyed
        // icon, and its label dims with it.
        [`& .${speedDialActionClasses.fab}.Mui-disabled`]: {
          // The theme's highest container tone: light grey, or its dark
          // counterpart in dark mode.
          bgcolor: theme.vars.sys.color.surfaceContainerHighest,
          color: 'action.disabled',
          boxShadow: theme.shadows[2],
        },
        // Only while open: MUI hides a closed dial's labels with opacity 0,
        // which this would otherwise override, leaving the label floating.
        [`& .${speedDialActionClasses.staticTooltip}:not(.${speedDialActionClasses.staticTooltipClosed}):has(.Mui-disabled) .${speedDialActionClasses.staticTooltipLabel}`]: {
          opacity: 0.6,
        },
        [`& .${speedDialActionClasses.staticTooltipLabel}`]: {
          bgcolor: 'transparent',
          color: 'text.primary',
          boxShadow: 'none',
          whiteSpace: 'nowrap',
          px: 0.5,
          py: 0,
          mr: 0,
          // M3's label medium.
          fontSize: '0.75rem',
          lineHeight: '1rem',
          fontWeight: 500,
          letterSpacing: '0.03125rem',
          // No chip: a halo in the paper's colour keeps it readable over the map.
          textShadow: [
            '0 0 2px',
            '0 0 3px',
            '0 0 4px',
          ].map((blur) => `${blur} ${theme.vars.palette.background.paper}`).join(', '),
        },
        // Labels take clicks (actionSlots): the hand, as on their buttons -
        // only while open: a closed dial keeps them in the page, invisible,
        // where they'd catch the pointer and open it.
        [`& .${speedDialActionClasses.staticTooltip}:not(.${speedDialActionClasses.staticTooltipClosed}) .oc-edit-cave-fab--label`]: { cursor: 'pointer', pointerEvents: 'auto' },
        // A label and its button are one control: hovering either hovers
        // both - the button in its hover colour, the label paler.
        [`& .${speedDialActionClasses.staticTooltip}:hover:not(:has(.Mui-disabled))`]: {
          [`& .${speedDialActionClasses.fab}`]: {
            bgcolor: theme.vars.palette.SpeedDialAction.fabHoverBg,
          },
          [`& .${speedDialActionClasses.staticTooltipLabel}`]: {
            opacity: 0.8,
          },
        },
      })}
    >
      {/* tooltip.open makes MUI render each action's title as a fixed label
          to the left of its icon (its "static tooltip") instead of a hover
          tooltip. */}
      {/* While editing this cave, the action becomes its opposite. */}
      {isEditingCave ? (
        <SpeedDialAction icon={<EditOffRounded />} onClick={exitEditMode} slotProps={actionSlots(t('exitEditMode'), exitEditMode)} />
      ) : (
        <SpeedDialAction icon={<EditRounded />} onClick={editCave} slotProps={actionSlots(caveId ? t('editCave') : t('editCaveNoneSelected'), editCave, !caveId)} />
      )}
      <SpeedDialAction icon={<AddRounded />} onClick={addNewCave} slotProps={actionSlots(t('addNewCave'), addNewCave)} />
    </SpeedDial>
    </Box>
  )
}
