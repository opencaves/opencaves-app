import { createContext, forwardRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fileOpen } from 'browser-fs-access'
import { Card, CardContent, CardMedia, LinearProgress, Typography } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import Snackbar from '@/components/Snackbar/Snackbar'
import { useUploadCaveImages } from './useUploadCaveImages'
import { appName } from '@/config/app'
import { acceptedExtensions, acceptedMimeTypes } from '@/config/mediaPane'

export const AddMediasContext = createContext(null)

export default function AddMediasProvider({ children }) {
  const [medias, setMedias] = useState([])
  const { uploadCaveImages, current, progress, done, error } = useUploadCaveImages()
  const { t: tPicker } = useTranslation('mediaPane')
  const { t } = useTranslation('mediaPane', { keyPrefix: 'addMedia' })
  const [snackbarOpen, setSnackbarOpen] = useState(false)

  const pickerOpts = {
    description: tPicker('images'),
    mimeTypes: acceptedMimeTypes,
    extensions: acceptedExtensions,
    multiple: true,
  }

  async function promptForMedias() {
    try {
      const files = await fileOpen(pickerOpts)

      if (files.length > 0) {
        setMedias(files)
      }
    } catch (error) {
      console.error(error)
    }
  }

  async function uploadMedias(files) {
    setSnackbarOpen(true)
    await uploadCaveImages(files)
  }

  useEffect(() => {
    async function doUploadMedias() {
      await uploadMedias(medias)
    }
    if (medias.length > 0) {
      doUploadMedias()

    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medias])

  useEffect(() => {
    if (done) {
      setSnackbarOpen(false)
    }
  }, [done])


  return (
    <AddMediasContext.Provider value={{ promptForMedias, uploadMedias }}>
      {children}
      <Snackbar
        open={snackbarOpen}
        autoHide={false}
      >
        <UploadInfo total={medias.length} progress={progress} current={current} />
      </Snackbar>
      {
        done && (
          <Snackbar
            open
          >
            <SnackbarContent sx={{ p: 2 }}>
              <Typography>{t('success', { count: done.count })}</Typography>
            </SnackbarContent>
          </Snackbar>
        )
      }
    </AddMediasContext.Provider >
  )
}

const UploadInfo = forwardRef((props, ref) => {
  const { total, progress, current } = props
  const { t } = useTranslation('mediaPane', { keyPrefix: 'addMedia' })

  return (
    <Card
      ref={ref}
      elevation={6}
      sx={{
        flexGrow: 1,
        display: 'flex',
        minWidth: {
          sm: 444
        }
      }}
    >
      <Grid sx={{ position: 'relative', width: '33%' }}>
        {
          current && (
            <CardMedia
              component='img'
              image={current.url}
              sx={{ position: 'absolute', width: '100%', height: '100%' }}
            />
          )
        }
      </Grid>
      <Grid
        container
        direction='column'
        flexGrow={1}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography color='text.secondary' gutterBottom>
            {t('uploadingTo')}
          </Typography>
          <Typography variant='h5' component='div' gutterBottom >
            {appName}
          </Typography>
          <Typography color='text.secondary' fontSize='small'>
            {t('countMedias', { index: current ? current.index : 0, total })}
          </Typography>
        </CardContent>
        <LinearProgress variant='determinate' value={progress} />
      </Grid>
    </Card>
  )
})

const SnackbarContent = forwardRef((props, ref) => {
  const { children, sx, ...otherProps } = props
  return (
    <Card
      ref={ref}
      elevation={6}
      sx={{
        flexGrow: 1,
        display: 'flex',
        minWidth: {
          sm: 444
        },
        ...sx
      }}
      {...otherProps}
    >
      {children}
    </Card>
  )
})