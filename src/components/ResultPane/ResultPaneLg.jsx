import React from 'react'
import { Scrollbars } from 'react-custom-scrollbars-3'
import { Card, CardContent } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { PANE_WIDTH, RESULT_PANE_MIN_HEIGHT } from '@/config/app.js'
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
        minHeight: `${RESULT_PANE_MIN_HEIGHT}px`,
        maxWidth: editMode ? `min(${PANE_WIDTH * 2}px, 80vw)` : `${PANE_WIDTH}px`,
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
        // Above the pane's sticky headers (the Sistema accordion's, z-index 1).
        renderTrackVertical={({ style, ...props }) => <div {...props} style={{ ...style, position: 'absolute', width: 6, right: 2, bottom: 2, top: 2, borderRadius: 3, zIndex: 2 }} />}
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
