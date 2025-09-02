import React from 'react'
import { Scrollbars } from 'react-custom-scrollbars-2'
import { Card, CardContent } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { resultPaneMinHeight } from '@/config/app'
import './ResultPaneLg.scss'

export default function ResultPaneLg({ children, ...props }) {

  const theme = useTheme()

  return (
    <Card
      {...props}
      className='oc-result-pane oc-result-pane-lg'
      sx={{
        position: 'relative',
        boxShadow: 5,
        '.MuiCardContent-root': {
          p: 0
        },
        minHeight: `${resultPaneMinHeight}px`
      }}
      component='main'
    >
      <Scrollbars
        autoHide
        autoHeight
        autoHeightMax='100vh'
        renderThumbVertical={({ style, ...props }) =>
          <div {...props} style={{
            ...style,
            cursor: 'pointer',
            borderRadius: 'inherit',
            backgroundColor: theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.12)'
          }} />
        }
      >
        <CardContent
          sx={{
            p: 0
          }}
        >
          {children}
        </CardContent>
      </Scrollbars>
    </Card >
  )
}