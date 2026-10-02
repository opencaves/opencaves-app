import { forwardRef } from 'react'
import { MenuItem as MUIMenuItem, styled } from '@mui/material'

// M3 label large (14px on 20px, weight 500), in the text's colour (onSurface).
const StyledMenuItem = styled(MUIMenuItem)(({ theme }) => ({
  fontSize: '0.875rem',
  fontWeight: 500,
  lineHeight: '1.25rem',
  color: theme.vars.palette.text.primary,
  paddingInline: theme.spacing(1.5),
}))

const MenuItem = forwardRef(function MenuItem({ className, ...props }, ref) {
  return <StyledMenuItem ref={ref} className={`oc-menu-item ${className || ''}`.trim()} {...props} />
})

export default MenuItem
