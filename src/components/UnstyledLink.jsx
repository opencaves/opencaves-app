import { forwardRef } from 'react'
import { styled } from '@mui/material'
import { Link } from 'react-router-dom'

const StyledLink = styled(Link)({
  color: 'inherit !important',
  textDecoration: 'none !important'
})

const UnstyledLink = forwardRef(function UnstyledLink({ className, ...props }, ref) {
  return <StyledLink ref={ref} className={`oc-unstyled-link ${className || ''}`.trim()} {...props} />
})

export default UnstyledLink
