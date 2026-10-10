import { forwardRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { Box, Card, CardContent, CardMedia, Chip, LinearProgress, Typography, useTheme } from '@mui/material'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'
import { Grid } from '@mui/material'
import Snackbar from '@/components/Snackbar/Snackbar.jsx'
import { ErrorAlert } from '@/components/Alert.jsx'
import { useUploadCaveImages } from './useUploadCaveImages.jsx'
import PhotoGpsCheckDialog from './PhotoGpsCheckDialog.jsx'
import { photosFarFromCave } from '@/utils/photoGps.js'
import { APP_NAME } from '@/config/app.js'
import { UPLOADING_DONE_HIDE_DELAY } from '@/config/mediaPane.js'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import pushId from 'unique-push-id'
import { addPendingUpload } from '@/services/offline/pendingUploads.js'
import { ACCEPTED_MIME_TYPES } from '@/config/mediaPane.js'
import { auth } from '@/config/firebase.js'

const codeFontFamily = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'

export default function UploadMedias({ medias, caveId }) {
  const [_medias, setMedias] = useState([])
  const { uploadCaveImages, current, progress, done, error } = useUploadCaveImages(caveId)
  const { t } = useTranslation('mediaPane', { keyPrefix: 'addMedia' })
  const [openSnackbar] = useSnackbar()
  const { t: tOffline } = useTranslation('offline')
  const [uploading, setUploading] = useState(false)
  const [isDone, setIsDone] = useState(done)
  const [errorAlertOpen, setErrorAlertOpen] = useState(false)
  // The cave the photos go to: its coordinates (position, entrance, parking, key), for the GPS check.
  const cave = useSelector((/** @type {RootState} */ state) => (caveId && (state.map.data?.find?.((c) => c.id === caveId) || state.data.caves?.find?.((c) => c.id === caveId))) || state.map.currentCave)
  // Photos taken far from the cave, waiting for the person's choice: { files, far }.
  const [review, setReview] = useState(null)
  const [uploadTotal, setUploadTotal] = useState(0)

  function onErrorAlertClose() {
    setErrorAlertOpen(false)
  }

  async function uploadMedias(files) {
    // Offline: kept on the device, to upload on Wi-Fi (PendingUploadsSync) -
    // a file of the wrong type still gets its error (uploadCaveImages) first.
    if (!navigator.onLine && files.every((file) => ACCEPTED_MIME_TYPES.includes(file.type))) {
      try {
        for (const file of files) {
          await addPendingUpload({ id: pushId(), kind: 'photo', uid: auth.currentUser?.uid ?? null, file, name: file.name, caveId: caveId ?? cave?.id })
        }
        openSnackbar(tOffline('pending.photosSaved', { count: files.length }), { severity: 'success' })
      } catch (cause) {
        console.error(cause)
        openSnackbar(t('unknownError'))
      }
      setMedias([])
      return
    }
    setUploadTotal(files.length)
    setUploading(true)
    await uploadCaveImages(files)
    setMedias([])
  }

  // Before uploading: the photos whose GPS position (EXIF) is far from the
  // cave are shown first; the others, and photos without GPS, pass.
  async function checkThenUpload(files) {
    const far = await photosFarFromCave(files, cave)
    if (far.length) setReview({ files, far })
    else await uploadMedias(files)
  }

  function reviewed(files) {
    setReview(null)
    if (files.length) uploadMedias(files)
    else setMedias([])
  }

  useEffect(() => {
    // console.log('done?: %o', done)
    setIsDone(done)
  }, [done])

  useEffect(() => {
    if (error) {
      setUploading(false)
      console.error('Error uploading media: %o', error)
    }
  }, [error])

  useEffect(() => {
    if (medias) {
      setMedias(medias)
    }
  }, [medias])

  useEffect(() => {
    async function doUploadMedias() {
      await checkThenUpload(_medias)
    }
    if (_medias.length > 0) {
      doUploadMedias()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_medias])

  // Done: the progress snackbar goes, the shared one confirms (green check).
  useEffect(() => {
    if (isDone) {
      setTimeout(() => {
        setUploading(false)
        setIsDone(false)
        openSnackbar(t('success', { count: done?.count ?? 0 }), { severity: 'success' })
      }, UPLOADING_DONE_HIDE_DELAY)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone])

  useEffect(() => {
    setErrorAlertOpen(error)
  }, [error])

  return (
    <>
      <Snackbar className="oc-upload-medias" open={uploading} autoHide={false}>
        <UploadInfo total={uploadTotal} progress={progress} current={current} />
      </Snackbar>

      {review && (
        <PhotoGpsCheckDialog
          caveName={cave?.name?.value ?? cave?.name}
          far={review.far}
          onDone={(skipped) => reviewed(review.files.filter((file) => !skipped.includes(file)))}
          onCancel={() => reviewed([])}
        />
      )}

      {errorAlertOpen && (
        <ErrorAlert className="oc-upload-medias--error-alert" open={true} onClose={onErrorAlertClose} header={t('errorHeader')} dismissLabel={t('unknownErrorBtn')} hint={error?.code === 'wrong-media-type' ? t('wrongMediaTypeHint') : undefined}>
          {error?.code === 'wrong-media-type' ? <WrongMediaTypeMessage fileNames={error.fileNames} /> : <Typography color="text.secondary">{t(error?.code === 'offline' ? 'needsConnection' : 'unknownError')}</Typography>}
        </ErrorAlert>
      )}

    </>
  )
}

function WrongMediaTypeMessage({ fileNames }) {
  const { t } = useTranslation('mediaPane', { keyPrefix: 'addMedia' })

  return (
    <>
      <Typography className="oc-wrong-media-type-message" color="text.secondary">
        {t('wrongMediaType', { count: fileNames.length })}
      </Typography>
      <Grid
        className="oc-wrong-media-type-message--files"
        container
        sx={{
          gap: 0.5,
          justifyContent: 'center',
          maxWidth: '100%',
        }}
      >
        {fileNames.map((fileName) => (
          <Chip
            key={fileName}
            label={fileName}
            size="small"
            variant="outlined"
            sx={{
              maxWidth: '100%',
              borderRadius: '6px',
              borderColor: 'divider',
              backgroundColor: 'rgba(175, 184, 193, 0.2)',
              '*:where([data-mui-color-scheme="dark"]) &': { backgroundColor: 'rgba(110, 118, 129, 0.4)' },
              '.MuiChip-label': {
                fontFamily: codeFontFamily,
                fontSize: '0.8125rem',
              },
            }}
          />
        ))}
      </Grid>
    </>
  )
}

export const UploadInfo = forwardRef((props, ref) => {
  const { total, progress, current } = props
  const { t } = useTranslation('mediaPane', { keyPrefix: 'addMedia' })

  return (
    <Card
      ref={ref}
      className="oc-upload-info"
      elevation={6}
      // A snackbar's colours (M3's inverse surface), as the others.
      sx={(theme) => ({
        flexGrow: 1,
        display: 'flex',
        bgcolor: theme.vars.sys.color.inverseSurface,
        color: theme.vars.sys.color.inverseOnSurface,
        '& .oc-upload-info--secondary': { color: theme.vars.sys.color.inverseOnSurface, opacity: 0.8 },
        minWidth: {
          sm: 444,
        },
      })}
    >
      <Grid sx={{ position: 'relative', width: '33%' }}>
        {current?.type === 'application/pdf' ? (
          <Box sx={{ position: 'absolute', width: '100%', height: '100%', display: 'grid', placeItems: 'center', bgcolor: 'action.hover' }}>
            <PictureAsPdfRounded color="primary" fontSize="large" />
          </Box>
        ) : current?.url ? (
          <CardMedia component="img" image={current.url} sx={{ position: 'absolute', width: '100%', height: '100%' }} />
        ) : null}
      </Grid>
      <Grid container sx={{ flexDirection: 'column', flexGrow: 1 }}>
        <CardContent
          sx={{
            flexGrow: 1,
            '&:last-child': {
              paddingBottom: 2,
            },
          }}
        >
          <Typography
            className="oc-upload-info--secondary"
            sx={{
              lineHeight: 1,
              margin: 0,
            }}
          >
            {t('uploadingTo')}
          </Typography>
          <Typography
            variant="h5"
            component="div"
            sx={{
              lineHeight: 1,
              marginTop: '.7em',
              marginBottom: '.7em',
            }}
          >
            {APP_NAME}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              borderRadius: 2,
              '> .MuiLinearProgress-bar': {
                borderRadius: 2,
              },
            }}
          />
          <Typography
            className="oc-upload-info--secondary"
            fontSize="small"
            sx={{
              textAlign: 'right',
              lineHeight: 1,
              marginTop: '.7em',
            }}
          >
            {t('countMedias', { index: current ? current.index : 0, total })}
          </Typography>
        </CardContent>
      </Grid>
    </Card>
  )
})
