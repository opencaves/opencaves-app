import { Box, Dialog, DialogContent, DialogContentText, DialogTitle, IconButton, Link, useMediaQuery, useTheme } from '@mui/material'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { toggleAboutDialog } from '../../redux/slices/appSlice'
import { ReactComponent as Logo } from '../../images/logo/brand-light.svg'
import { CloseRounded } from '@mui/icons-material'


export default function About() {

  const dispatch = useDispatch()
  const { aboutDialogOpen } = useSelector(state => state.app)
  const { t } = useTranslation('aboutDialog')
  const theme = useTheme()
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

  function onDialogClose() {
    dispatch(toggleAboutDialog())
  }

  return (
    <Dialog
      className='dialog'
      open={aboutDialogOpen}
      onClose={onDialogClose}
      aria-label={t('ariaLabel')}
      // fullScreen={isSmall}
      maxWidth={false}
    >
      <IconButton
        aria-label={t('close')}
        onClick={onDialogClose}
        sx={{
          position: 'absolute',
          right: '0.5rem',
          top: '0.5rem',
          color: (theme) => theme.palette.grey[500]
        }}
      >
        <CloseRounded />
      </IconButton>
      <DialogContent>
        <Box
          sx={{
            width: isSmall ? '70vmin' : '60vmin',
            maxWidth: '600px',
            textAlign: 'center',
            mt: 6,
            mb: 4
          }}>
          <Logo
            width={isSmall ? '70%' : '60%'}
          />
        </Box>
        <DialogContentText
          fontSize='small'
          textAlign='center'
        >
          {t('version', { version: process.env.REACT_APP_VERSION })} <Link href="https://github.com/opencaves/opencaves-app/blob/main/CHANGELOG.md" target='_blank' ml={1}>{t('whatsNew')}</Link>
        </DialogContentText>
      </DialogContent>
    </Dialog>
  )
}