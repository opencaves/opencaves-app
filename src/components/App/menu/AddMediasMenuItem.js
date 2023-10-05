import { useTranslation } from 'react-i18next'
import MenuItem from '@/components/App/MenuItem'
import { useAddMedias } from '@/components/AddMedias/useAddMedias'

export default function AddMediasMenuItem() {
  const { t } = useTranslation('app', { keyPrefix: 'menu' })
  const { promptForMedias } = useAddMedias()

  return (
    <MenuItem onClick={promptForMedias}>
      {t('addPictures')}
    </MenuItem>
  )
}