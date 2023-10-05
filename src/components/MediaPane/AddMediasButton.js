import { cloneElement } from 'react'
import { useTranslation } from 'react-i18next'
import MenuItem from '@/components/App/MenuItem'
import { useAddMedias } from '@/components/AddMedias/useAddMedias'
import { Button } from '@mui/material'

function DefaultMenuItemComponent(props) {
  const { t } = useTranslation('app', { keyPrefix: 'menu' })

  return (
    <Button {...props}>
      {t('addPictures')}
    </Button>
  )
}

export default function AddMediasButton({ component = <DefaultMenuItemComponent />, ...props }) {
  const { promptForMedias } = useAddMedias()
  // const button = component ? <component {...props} /> : <DefaultMenuItemComponent {...props} />

  return (
    cloneElement(component, { ...props, onClick: promptForMedias })
  )
}