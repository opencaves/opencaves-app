import React from 'react'
import { Scrollbars } from 'react-custom-scrollbars-3'
import { Card, CardContent } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { paneWidth, resultPaneMinHeight } from '@/config/app.js'
import './ResultPaneLg.scss'

export default function ResultPaneLg({ children, editMode, cave, ...props }) {
  const theme = useTheme()

  const widthTransition = theme.transitions.create('max-width', {
    duration: theme.oc.sys.motion.duration.emphasized,
    easing: theme.sys.motion.easing.emphasizedDecelerate,
  })
  const heightTransition = theme.transitions.create('min-height', {
    duration: theme.oc.sys.motion.duration.emphasized,
    easing: theme.sys.motion.easing.emphasizedDecelerate,
  })

  return (
    <Card
      {...props}
      className="oc-result-pane oc-result-pane-lg"
      sx={{
        position: 'relative',
        boxShadow: 5,
        '.MuiCardContent-root': {
          p: 0,
        },
        minHeight: `${resultPaneMinHeight}px`,
        maxWidth: editMode ? `min(${paneWidth * 2}px, 80vw)` : `${paneWidth}px`,
        transition: widthTransition,
      }}
      component="main"
    >
      <Scrollbars
        autoHide
        autoHeight
        // In edit mode, force the scrollable area to always fill the full
        // viewport height (not just cap there) so the pane elongates even
        // when the form's content is short, instead of only growing up to
        // content height like the read-only view does.
        autoHeightMin={editMode ? '100vh' : 0}
        autoHeightMax="100vh"
        style={{ transition: heightTransition }}
        renderThumbVertical={({ style, ...props }) => (
          <div
            {...props}
            style={{
              ...style,
              cursor: 'pointer',
              borderRadius: 'inherit',
              backgroundColor: theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.12)',
            }}
          />
        )}
      >
        <CardContent
          sx={{
            p: 0,
          }}
        >
          {children}
        </CardContent>
      </Scrollbars>
    </Card>
  )
}
