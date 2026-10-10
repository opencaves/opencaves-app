import { forwardRef } from 'react'
import { styled } from '@mui/material'
import { Link } from 'react-router-dom'

const StyledLink = styled(Link)({
  color: 'inherit !important',
  textDecoration: 'none !important'
})

/**
 * A router Link in its surrounding text's color, not underlined.
 */
const UnstyledLink = forwardRef(function UnstyledLink(/** @type {import('react-router-dom').LinkProps} */ { className, ...props }, /** @type {import('react').Ref<HTMLAnchorElement>} */ ref) {
  return <StyledLink ref={ref} className={`oc-unstyled-link ${className || ''}`.trim()} {...props} />
})

export default UnstyledLink
