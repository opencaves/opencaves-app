import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useDropzone } from 'react-dropzone'
import { Box, IconButton, Dialog, DialogTitle, DialogContent, Typography, Button, LinearProgress } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { Close, PhotoOutlined } from '@mui/icons-material'
import Or from '@/components/utils/Or'
import { useSnackbar } from '@/components/Snackbar/useSnackbar'
import Message from '../App/Message'
import { useUploadCaveImages } from '@/components/AddMedias/useUploadCaveImages'
import { acceptedMimeTypes } from '@/config/mediaPane'

export default function AddMediaLg() {
  const navigate = useNavigate()
  const user = useSelector(state => state.session.user)

  const currentCave = useSelector(state => state.map.currentCave)
  const [openSnackbar] = useSnackbar()

  const { t } = useTranslation('mediaPane', { keyPrefix: 'addMedia' })

  const [addMediaOpen, setAddMediaOpen] = useState(true)
  const [files, setFiles] = useState([])
  const [onError, setOnError] = useState(null)
  const { progress, done, error } = useUploadCaveImages(files, currentCave.id)

  function onAddMediaClose() {
    setAddMediaOpen(false)
    navigate('..', { replace: true })
  }

  function onDrop(droppeddFiles) {
    if (droppeddFiles.length > 0) {
      setFiles(droppeddFiles)
    }
  }

  useEffect(() => {
    if (error) {
      setOnError(true)
      setFiles([])
      console.log('An error occured! %o', error)
    }
  }, [error, done])

  useEffect(() => {
    if (done) {
      setFiles([])
      openSnackbar(<Message message={t('success', { count: done.count })} />)
      return
    }
  }, [done, error, t, openSnackbar])

  return (
    user && (
      <Dialog
        open={addMediaOpen}
        onClose={onAddMediaClose}
        maxWidth='md'
        fullWidth
      >
        <DialogTitle>
          {t('header', { name: currentCave.name.value })}
          <IconButton
            aria-label={t('closeBtn.ariaLabel')}
            onClick={onAddMediaClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>

          <Dropzone onDrop={onDrop} progress={progress} onError={onError} setOnError={setOnError} />

        </DialogContent>
      </Dialog>
    )
  )
}

export function Dropzone({ onDrop, progress, onError, setOnError }) {
  const { t } = useTranslation('mediaPane', { keyPrefix: 'addMedia' })
  const [openSnackbar] = useSnackbar({ autoHide: false })
  const _onDrop = useCallback(droppeddFiles => {
    const wrongFile = droppeddFiles.find(file => !acceptedMimeTypes.includes(file.type))
    if (wrongFile) {
      openSnackbar(
        <Message
          message={t('wrongMediaType')}
          type='error'
          footer={
            <Grid
              container
              flexWrap='nowrap'
              mt={1.75}
              ml={.4}
              sx={{ color: '#c1c1c1' }}
            >
              <PhotoOutlined fontSize='small' sx={{ mr: 1.5 }} />
              <Typography variant='caption' component='span' ml={.2} >{wrongFile.name}</Typography>
            </Grid >
          }
        />
      )
    } else {
      onDrop(droppeddFiles)
    }
  }, [onDrop, openSnackbar, t])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop: _onDrop })

  function onErrorMessageBtnClick(event) {
    event.stopPropagation()
    setOnError(null)
  }

  if (onError) {
    return (
      <Container>
        <Grid container>
          <Message type='error' fontSize={24} message={t('unknownError')}></Message>
          <Grid>
            <Button variant='outlined' onClick={onErrorMessageBtnClick}>{t('unknownErrorBtn')}</Button>
          </Grid>
        </Grid>
      </Container>
    )
  }

  return (
    <Container
      rootProps={getRootProps()}
      isDragActive={isDragActive}
    >
      <input {...getInputProps()} />
      {
        typeof progress === 'number' ? (
          <Box
            sx={{
              width: '80%',
              mx: 'auto'
            }}
          >
            <LinearProgress variant='determinate' value={progress} />
          </Box>
        ) : (
          isDragActive ? (
            <Typography variant='h3' fontWeight={300}>{t('dropHere')}</Typography>
          ) : (
            <Grid
              direction='column'
              justifyContent='center'
              alignItems='center'
              textAlign='center'
              container
            >
              <Typography variant='h3' fontWeight={300}>{t('dragHere')}</Typography>
              <Or strokeWidth='73px' my={3}>{t('or')}</Or>
              <Button variant='outlined'>{t('btn')}</Button>
            </Grid>
          )
        )
      }
    </Container>
  )
}

function Container({ children, rootProps = {}, onError, isDragActive }) {
  return (
    <Grid container>
      <Grid
        {...rootProps}
        container
        justifyContent='center'
        alignItems='center'
        xs
        sx={{
          borderStyle: 'dashed',
          borderWidth: 4,
          borderColor: onError ? 'error' : isDragActive ? 'secondary.main' : '#ddd',
          borderRadius: '2px',
          height: 400,
          transitionProperty: 'border',
          transitionDuration: '150ms'
        }}
      >
        {children}
      </Grid>
    </Grid>
  )
}