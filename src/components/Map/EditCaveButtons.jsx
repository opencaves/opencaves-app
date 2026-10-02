import { useTranslation } from 'react-i18next'
import { IconButton, Tooltip } from '@mui/material'
import AddRounded from '@mui/icons-material/AddRounded'
import EditOutlined from '@mui/icons-material/EditOutlined'
import EditRounded from '@mui/icons-material/EditRounded'
import { useEditCaveActions } from './EditCaveFab.jsx'

// The edit FAB's two actions as separate icon buttons, for the mobile result
// pane's header - where the FAB itself is hidden once the sheet is mostly
// open. Editors only, like the FAB.
export default function EditCaveButtons({ sx }) {
  const { t } = useTranslation('map', { keyPrefix: 'editFab' })
  const { canEdit, caveId, isEditingCave, editCave, exitEditMode, addNewCave } = useEditCaveActions()

  if (!canEdit) {
    return null
  }

  return (
    <>
      {/* A toggle: pressed while editing this cave, when it leaves edit mode
          (the form's unsaved-changes prompt still applies). */}
      <Tooltip title={isEditingCave ? t('exitEditMode') : t('editCave')} describeChild>
        <span>
          <IconButton
            className="oc-edit-cave-btn"
            aria-label={t('editCave')}
            aria-pressed={isEditingCave}
            onClick={isEditingCave ? exitEditMode : editCave}
            disabled={!caveId}
            // On: a filled, primary-colored icon (no container).
            sx={[sx, isEditingCave && { color: 'primary.main' }]}
          >
            {isEditingCave ? <EditRounded /> : <EditOutlined />}
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t('addNewCave')}>
        <IconButton className="oc-add-new-cave-btn" aria-label={t('addNewCave')} onClick={addNewCave} sx={sx}>
          <AddRounded />
        </IconButton>
      </Tooltip>
    </>
  )
}
