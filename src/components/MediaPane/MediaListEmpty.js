import { AddAPhotoOutlined } from '@mui/icons-material'
import { Box, Button, Typography } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import AddMedias from '@/components/App/menu/AddMediasMenuItem'
import { useSmall } from '@/hooks/useSmall'

function AddMediasBtn() {
  const { t } = useTranslation('mediaPane', { keyPrefix: 'empty' })
  const isSmall = useSmall()

  return isSmall ? (
    <AddMedias
      component={
        <Button
          size='large'
          variant='outlined'
          startIcon={<AddAPhotoOutlined />}
        >
          {t('btn')}
        </Button>
      } />
  ) : (
    <Button
      LinkComponent={Link}
      size='large'
      variant='outlined'
      startIcon={<AddAPhotoOutlined />}
      to='add'
    >
      {t('btn')}
    </Button>
  )
}

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

        <AddMediasBtn />
      </Box>
    </Box>
  )
}