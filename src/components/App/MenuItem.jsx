import { MenuItem as MUIMenuItem, styled } from '@mui/material'

const MenuItem = styled(MUIMenuItem)({
  fontSize: 'var(--md-sys-typescale-label-large-size)',
  fontWeight: 'var(--md-sys-typescale-label-large-weight)',
  lineHeight: 'var(--md-sys-typescale-label-large-height)',
  color: 'var(--md-sys-color-onSurface)',
  px: 1.5,
})

export default MenuItem