import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { MenuItem } from '@mui/material'
import { useSnackbar } from '@/components/Snackbar/useSnackbar'

export default function UseAsCoverImage({ mediaAsset }) {

  const { t } = useTranslation('mediaPane', { keyPrefix: 'menu' })
  const user = useSelector(state => state.session.user)
  const [openSnackbar] = useSnackbar()
  const [isEditor, setIsEditor] = useState(false)

  useEffect(() => {
    async function getIdToken() {
      if (user) {
        const idTokenResult = await user.getIdTokenResult()
        if (idTokenResult.claims.roles && idTokenResult.claims.roles.includes('editor')) {
          setIsEditor(true)
        }
      }
    }

    getIdToken()
  }, [user])

  async function onUseAsCoverImageClick() {
    try {

      await mediaAsset.setAsCoverImage()

      openSnackbar(t('useAsCoverSuccess'))

    } catch (error) {
      console.error(error)
      openSnackbar(t('useAsCoverFail'), { autoHide: false, hideOnClickAway: true })
    } finally {
      // handleClose()
    }
  }

  return isEditor && (
    <MenuItem onClick={onUseAsCoverImageClick} disabled={mediaAsset.isCover}>{t('useAsCoverImage')}</MenuItem>
  )
}