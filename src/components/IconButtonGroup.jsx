import { Box } from '@mui/material'

/**
 * Icon buttons side by side, MD3-spaced: 8dp apart, so their 48dp touch
 * targets (the theme's MuiIconButton) don't overlap.
 *
 * @param {import('@mui/material/Box').BoxProps} props - Its root's (a Box's).
 */
export default function IconButtonGroup({ children, className, sx, ...props }) {
  return (
    <Box
      className={`oc-icon-button-group ${className || ''}`.trim()}
      sx={[{ display: 'flex', alignItems: 'center', gap: 'var(--mui-oc-iconButton-gap, 8px)' }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...props}
    >
      {children}
    </Box>
  )
}
