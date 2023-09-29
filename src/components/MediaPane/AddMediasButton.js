import { cloneElement } from 'react'
import { useTranslation } from 'react-i18next'
import MenuItem from '@/components/App/MenuItem'

function DefaultMenuItemComponent({ onClick }) {
  const { t } = useTranslation('app', { keyPrefix: 'menu' })

  return (
    <MenuItem onClick={onClick}>
      {t('addPictures')}
    </MenuItem>
  )
}

export default function AddMediasButton({ component }) {

  async function onAddMediasBtnClick() {

  }


  return (
    cloneElement(component, { onClick: onAddMediasBtnClick })
  )
}