import { forwardRef } from 'react'
import { MenuItem as MUIMenuItem, styled } from '@mui/material'

const StyledMenuItem = styled(MUIMenuItem)({
  fontSize: 'var(--md-sys-typescale-label-large-size)',
  fontWeight: 'var(--md-sys-typescale-label-large-weight)',
  lineHeight: 'var(--md-sys-typescale-label-large-height)',
  color: 'var(--md-sys-color-onSurface)',
  px: 1.5,
})

const MenuItem = forwardRef(function MenuItem({ className, ...props }, ref) {
  return <StyledMenuItem ref={ref} className={`oc-menu-item ${className || ''}`.trim()} {...props} />
})

export default MenuItem
