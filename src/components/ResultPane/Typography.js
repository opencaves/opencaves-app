import { Typography } from '@mui/material'
import { styled } from '@mui/material/styles'

const StyledTextSecondary = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.875rem',
  fontWeight: 400,
  lineHeight: '1.25rem',
  letterSpacing: 0
}))

export function TextSecondary({ children, ...props }) {
  return <StyledTextSecondary {...props}>{children}</StyledTextSecondary>
}