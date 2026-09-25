import { useTranslation } from 'react-i18next'
import MenuItem from '@/components/App/MenuItem.jsx'
import { useAddMedias } from '@/components/AddMedias/useAddMedias.jsx'

export default function AddMediasMenuItem() {
  const { t } = useTranslation('app', { keyPrefix: 'menu' })
  const { promptForMedias } = useAddMedias()

  return (
    <MenuItem className="oc-add-medias-menu-item" onClick={promptForMedias}>
      {t('addPictures')}
    </MenuItem>
  )
}