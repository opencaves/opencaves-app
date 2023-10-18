import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDropzone } from 'react-dropzone'
import { Dialog, Icon, SvgIcon, Typography, useTheme } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import UploadMedias from './UploadMedias'
import { acceptedMimeTypes } from '@/config/mediaPane'
import { ReactComponent as DropIcon } from '@/images/media-pane/drop.svg'

export default function Dropzone({ open = false, onDrop = () => { } }) {
  const theme = useTheme()
  const { t } = useTranslation('mediaPane', { keyPrefix: 'addMedia' })
  const [_open, setOpen] = useState(open)


  const baseStyle = {
    height: '100%',
    '--oc-dropzone-border-color': theme.palette.secondary.light,
    '> .oc-dropzone': {
      padding: '20px',
      margin: 2,
      borderWidth: 4,
      borderRadius: 2,
      borderColor: 'var(--oc-dropzone-border-color)',
      borderStyle: 'dashed',
      backgroundColor: '#fafafa',
      // color: '#bdbdbd',
      outline: 'none',
      transition: 'all .24s ease-in-out'
    }
  }

  const focusedStyle = {
    // borderColor: '#2196f3'
  }

  const acceptStyle = {
    '--oc-dropzone-border-color': theme.palette.secondary.main
  }

  const rejectStyle = {
    borderColor: 'error'
  }

  const {
    acceptedFiles,
    getRootProps,
    getInputProps,
    isFocused,
    isDragAccept,
    isDragReject
  } = useDropzone({
    accept: acceptedMimeTypes.reduce((accept, mime) => {
      accept[mime] = []
      return accept
    }, {}),
    // onDragEnter: onDropzoneDragEnter,
    onDragLeave: onDropzoneDragLeave,
    onDrop: onDropzoneDrop
  })

  const sx = useMemo(() => ({
    ...baseStyle,
    ...(isFocused ? focusedStyle : {}),
    ...(isDragAccept ? acceptStyle : {}),
    ...(isDragReject ? rejectStyle : {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    isFocused,
    isDragAccept,
    isDragReject
  ])

  function onDropzoneDrop() {
    setOpen(false)
    onDrop()
  }

  function onDropzoneDragEnter() {
    console.log('[onDropzoneDragEnter] %o', arguments)
  }

  function onDropzoneDragLeave() {
    console.log('[onDropzoneDragLeave]')
    setOpen(false)
  }

  useEffect(() => {
    console.log('open: %o', open)
    if (open) {
      setOpen(open)
    }
  }, [open])

  return (
    <>
      <Dialog
        open={_open}
        fullScreen={true}
        disableEscapeKeyDown={true}
        transitionDuration={350}
      >
        <Grid
          container
          {...getRootProps({ sx })}
        >
          <Grid
            className='oc-dropzone'
            container
            direction='column'
            alignItems='center'
            justifyContent='center'
            flex={1}
          >
            <SvgIcon component={DropIcon} inheritViewBox sx={{ fontSize: '10rem' }} color='primary' />
            <Typography
              fontSize='1.875rem'
              letterSpacing={0}
              fontWeight={300}
              lineHeight={1}
              mt={2}
            >{t('dropHere')}</Typography>
          </Grid>
        </Grid>
      </Dialog>
      <UploadMedias medias={acceptedFiles} />
    </>
  )
}