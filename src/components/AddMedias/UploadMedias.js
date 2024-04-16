import { forwardRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Card, CardContent, CardMedia, LinearProgress, Typography } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import Snackbar from '@/components/Snackbar/Snackbar'
import Message from '@/components/App/Message'
import { useUploadCaveImages } from './useUploadCaveImages'
import { appName } from '@/config/app'
import { uploadCompleteHideDuration, uploadingDoneHideDelay } from '@/config/mediaPane'

export default function UploadMedias({ medias }) {
  const [_medias, setMedias] = useState([])
  const { uploadCaveImages, current, progress, done, error } = useUploadCaveImages()
  const { t } = useTranslation('mediaPane', { keyPrefix: 'addMedia' })
  const [uploading, setUploading] = useState(false)
  const [uploadComplete, setUploadComplete] = useState(false)
  const [isDone, setIsDone] = useState(done)

  async function uploadMedias(files) {
    setUploading(true)
    await uploadCaveImages(files)
    setMedias([])
    console.log('-------------- upload complete?')
  }

  useEffect(() => {
    console.log('done?: %o', done)
    setIsDone(done)
  }, [done])

  useEffect(() => {
    if (error) {
      setUploading(false)
      console.error('Error uploading media: %o', error)
    }
  }, [error])

  useEffect(() => {
    console.log('------------- use effect [medias]: %o', medias)
    if (medias) {
      setMedias(medias)
    }
  }, [medias])

  useEffect(() => {
    async function doUploadMedias() {
      await uploadMedias(_medias)
    }
    if (_medias.length > 0) {
      doUploadMedias()

    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_medias])

  useEffect(() => {
    if (isDone) {
      setTimeout(() => {
        setUploadComplete(true)
        setUploading(false)
      }, uploadingDoneHideDelay)
    }
  }, [isDone])

  useEffect(() => {
    if (uploadComplete) {
      setIsDone(false)
      setTimeout(() => {
        setUploadComplete(false)
      }, uploadCompleteHideDuration)
    }
  }, [uploadComplete])


  return (
    <>
      <Snackbar
        open={uploading}
        autoHide={false}
      >
        <UploadInfo total={medias.length} progress={progress} current={current} />
      </Snackbar>

      {
        done && (
          <Snackbar
            open={uploadComplete}
            autoHide={false}
          >
            <SnackbarContent>
              <Alert>##################################
                {t('success', { count: done.count })}
              </Alert>
            </SnackbarContent>
          </Snackbar >
        )
      }

      {
        error && (
          <Snackbar
            open={true}
            autoHide={false}
          >
            <SnackbarContent>
              {/* <Typography>{t('success', { count: done.count })}</Typography> */}
              <Message message={t('unknownError')} />
            </SnackbarContent>
          </Snackbar>
        )
      }
    </>
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
        <CardContent
          sx={{
            flexGrow: 1,
            '&:last-child': {
              paddingBottom: 2
            }
          }}
        >
          <Typography
            color='text.secondary'
            sx={{
              lineHeight: 1,
              margin: 0
            }}
          >
            {t('uploadingTo')}
          </Typography>
          <Typography
            variant='h5'
            component='div'
            sx={{
              lineHeight: 1,
              marginTop: '.7em',
              marginBottom: '.7em'
            }}
          >
            {appName}
          </Typography>
          <LinearProgress
            variant='determinate'
            value={progress}
            sx={{
              borderRadius: 2,
              '> .MuiLinearProgress-bar': {
                borderRadius: 2
              }
            }} />
          <Typography
            color='text.secondary'
            fontSize='small'
            sx={{
              textAlign: 'right',
              lineHeight: 1,
              marginTop: '.7em'
            }}
          >
            {t('countMedias', { index: current ? current.index : 0, total })}
          </Typography>
        </CardContent>
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