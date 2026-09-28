import { useTranslation } from 'react-i18next'
import { IconButton, Tooltip } from '@mui/material'
import { AddRounded, EditRounded } from '@mui/icons-material'
import { useEditCaveActions } from './EditCaveFab.jsx'

// The edit FAB's two actions as separate icon buttons, for the mobile result
// pane's header - where the FAB itself is hidden once the sheet is mostly
// open. Editors only, like the FAB.
export default function EditCaveButtons({ sx }) {
  const { t } = useTranslation('map', { keyPrefix: 'editFab' })
  const { canEdit, caveId, isEditingCave, editCave, addNewCave } = useEditCaveActions()

  if (!canEdit) {
    return null
  }

  return (
    <>
      {/* Already editing this cave: nothing for it to do, so it's left out. */}
      {!isEditingCave && (
        <Tooltip title={t('editCave')}>
          <span>
            <IconButton className="oc-edit-cave-btn" aria-label={t('editCave')} onClick={editCave} disabled={!caveId} sx={sx}>
              <EditRounded />
            </IconButton>
          </span>
        </Tooltip>
      )}
      <Tooltip title={t('addNewCave')}>
        <IconButton className="oc-add-new-cave-btn" aria-label={t('addNewCave')} onClick={addNewCave} sx={sx}>
          <AddRounded />
        </IconButton>
      </Tooltip>
    </>
  )
}
