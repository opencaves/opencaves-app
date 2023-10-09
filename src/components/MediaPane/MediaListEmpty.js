import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AddAPhotoOutlined } from '@mui/icons-material'
import { Box, Typography } from '@mui/material'
import AddMediasButton from './AddMediasButton'

export default function MediaPaneEmpty() {
  const { t } = useTranslation('mediaPane', { keyPrefix: 'empty' })
  const containerRef = useRef(null)
  const [containerY, setContainerY] = useState(0)

  useEffect(() => {
    setContainerY(Math.floor(containerRef.current.getBoundingClientRect().y))
  }, [containerRef])

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: () => `calc(calc(var(--vh, 1vh) * 100) - ${containerY}px)`,
        px: 'var(--oc-pane-padding-inline)'
      }}
    >
      <Box
        textAlign='center'
      >
        <Typography sx={{ fontSize: '1.55rem', fontWeight: 300, mb: 4 }}>{t('header')}</Typography>

        <AddMediasButton
          variant='outlined'
          size='large'
          startIcon={<AddAPhotoOutlined />}
        />
      </Box>
    </Box>
  )
}