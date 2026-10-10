import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, Grid, Typography } from '@mui/material'
import PhotoRounded from '@mui/icons-material/PhotoRounded'
import AddRounded from '@mui/icons-material/AddRounded'
import PageFab from '@/components/PageFab.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import Snackbar from '@/components/Snackbar/Snackbar.jsx'
import Message from '@/components/Message.jsx'
import { UploadInfo } from '@/components/AddMedias/UploadMedias.jsx'
import { UpdateSnackbar } from '@/components/App/ManageAppUpdate.jsx'

/**
 * Development only (/dev/snackbars): each kind of snackbar the app shows, to
 * look at in both color schemes - a message, "saved" (success), an error
 * with a detail line (AddMediaLg's wrong file type), an error kept open with
 * its close button, the update available (with its action) and the upload
 * progress (its content a card) - with a page's FAB, which they push up.
 * Its buttons name the kinds, for developers.
 */
export default function SnackbarPreview() {
  const { t } = useTranslation('mediaPane')
  const { t: tApp } = useTranslation('app')
  const [openSnackbar, closeSnackbar] = useSnackbar()
  const [shown, setShown] = useState(null)
  const show = (kind) => {
    closeSnackbar()
    setShown(kind)
    if (kind === 'message') openSnackbar(tApp('snackbar.saveError', { name: 'Cenote Example' }))
    if (kind === 'success') openSnackbar(tApp('snackbar.saved', { name: 'Cenote Example' }), { severity: 'success' })
    if (kind === 'error-detail')
      openSnackbar(
        <Message
          message={t('addMedia.wrongMediaType', { count: 1 })}
          type="error"
          footer={
            <Grid container sx={{ mt: 1.75, ml: 0.4, flexWrap: 'nowrap', color: 'inherit', opacity: 0.75 }}>
              <PhotoRounded fontSize="small" sx={{ mr: 1.5 }} />
              <Typography variant="caption" component="span" sx={{ ml: 0.2 }}>
                photo.heic
              </Typography>
            </Grid>
          }
        />,
        { autoHide: false },
      )
    if (kind === 'error') openSnackbar(<Message message={t('menu.deleteFail')} type="error" />, { autoHide: false })
  }
  const kinds = ['message', 'success', 'error-detail', 'error', 'update', 'upload']
  return (
    <Box className="oc-snackbar-preview" sx={{ p: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {kinds.map((kind) => (
        <Button key={kind} variant={shown === kind ? 'contained' : 'outlined'} onClick={() => show(kind)} data-kind={kind}>
          {kind}
        </Button>
      ))}
      <PageFab onClick={() => {}} label="FAB" icon={<AddRounded />} />
      <UpdateSnackbar open={shown === 'update'} onReload={() => setShown(null)} />
      <Snackbar open={shown === 'upload'} autoHide={false}>
        <UploadInfo total={3} progress={40} current={{ type: 'image/jpeg', url: '/pages/bg.webp' }} />
      </Snackbar>
    </Box>
  )
}
