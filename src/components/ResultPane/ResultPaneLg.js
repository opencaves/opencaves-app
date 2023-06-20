import React from 'react'
import { Card, CardContent } from '@mui/material'
import './ResultPaneLg.scss'

export default function ResultPaneLg({ children }) {

  return (
    <Card
      className='oc-result-pane oc-result-pane-lg'
      sx={{
        position: 'relative',
        boxShadow: 5,
        '.MuiCardContent-root': {
          p: 0
        }
      }}
    >
      <CardContent
        sx={{
          p: 0
        }}
      >
        {children}
      </CardContent>
    </Card >
  )
}