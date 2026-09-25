import { cloneElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@mui/material'
import { useAddMedias } from '@/components/AddMedias/useAddMedias.jsx'

function DefaultMenuItemComponent(props) {
  const { t } = useTranslation('app', { keyPrefix: 'menu' })

  return (
    <Button {...props} className={`oc-default-menu-item-component ${props.className || ''}`.trim()}>
      {t('addPictures')}
    </Button>
  )
}

export default function AddMediasButton({ component = <DefaultMenuItemComponent />, ...props }) {
  const { promptForMedias } = useAddMedias()

  return (
    cloneElement(component, {
      ...props,
      onClick: promptForMedias,
      className: `oc-add-medias-button ${[component.props.className, props.className].filter(Boolean).join(' ')}`.trim(),
    })
  )
}