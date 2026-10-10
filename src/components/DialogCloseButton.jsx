import { useTranslation } from 'react-i18next'
import { IconButton, Tooltip } from '@mui/material'
import CloseRounded from '@mui/icons-material/CloseRounded'

/**
 * A dialog's "X", at its top right (give the DialogTitle room for it: pr 7).
 */
export default function DialogCloseButton({ onClick, disabled = false, label, className }) {
  const { t } = useTranslation('app')
  const title = label || t('closeDialog')

  return (
    <Tooltip title={title}>
      <IconButton className={['oc-dialog-close-button', className].filter(Boolean).join(' ')} aria-label={title} onClick={onClick} disabled={disabled} sx={{ position: 'absolute', top: 12, right: 12 }}>
        <CloseRounded />
      </IconButton>
    </Tooltip>
  )
}
