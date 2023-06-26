import React from 'react'
import { Card, CardContent } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Scrollbars } from 'react-custom-scrollbars-2'
import './ResultPaneLg.scss'

export default function ResultPaneLg({ children }) {

  const theme = useTheme()

  return (
    <Card
      className='oc-result-pane oc-result-pane-lg'
      sx={{
        position: 'relative',
        boxShadow: 5,
        '.MuiCardContent-root': {
          p: 0
        },
        minHeight: '300px'
      }}
      component='main'
    >
      <Scrollbars
        autoHide
        autoHeight
        autoHeightMax='100vh'
        renderThumbVertical={({ style, ...props }) =>
          <div {...props} className='awef' style={{
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