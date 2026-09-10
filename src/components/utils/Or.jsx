import { Box } from '@mui/material'

export default function Or({ strokeWidth, sx, children, ...props }) {

  return (
    <Box
      component='span'
      // bgcolor='background.paper'
      sx={{
        '--oc_gap': '0.75em',
        '--oc_stroke-color': 'var(--md-palette-divider)',
        '--oc_stroke-thick': '1.5px',
        '--oc_stroke-style': 'solid',
        '--oc_min-width': strokeWidth || '2em',

        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--oc-or-gap, var(--oc_gap))',
        position: 'relative',
        zIndex: 1,
        '&::before': {
          content: '""',
          flexGrow: 1,
          minWidth: 'var(--oc-or-stroke-width, var(--oc_min-width))',
          borderBottomWidth: 'var(--oc-or-stroke-thick, var(--oc_stroke-thick))',
          borderBottomStyle: 'var(--oc-or-stroke-style, var(--oc_stroke-style))',
          borderImage: 'linear-gradient(to left, var(--oc-or-stroke-color, var(--oc_stroke-color)) 70%, rgba(0, 0, 0, 0) 100%) 1'
        },
        '&::after': {
          content: '""',
          flexGrow: 1,
          minWidth: 'var(--oc-or-stroke-width, var(--oc_min-width))',
          borderBottomWidth: 'var(--oc-or-stroke-thick, var(--oc_stroke-thick))',
          borderBottomStyle: 'var(--oc-or-stroke-style, var(--oc_stroke-style))',
          borderImage: 'linear-gradient(to right, var(--oc-or-stroke-color, var(--oc_stroke-color)) 70%,rgba(0, 0, 0, 0) 100%) 1'
        },
        ...sx
      }}
      {...props}
    >
      {children}
    </Box>
  )
}