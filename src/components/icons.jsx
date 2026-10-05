import { useId } from 'react'
import { SvgIcon } from '@mui/material'
import NavigateNextRoundedSvg from '@/images/icons/navigate-next-rounded.svg?react'
import EmailFastOutlineSvg from '@/images/icons/email-fast-outline.svg?react'

export function NavigateNextRounded() {
  return (
    <SvgIcon className="oc-navigate-next-rounded" inheritViewBox>
      <NavigateNextRoundedSvg />
    </SvgIcon>
  )
}

export function EmailFastOutline() {
  return (
    <SvgIcon className="oc-email-fast-outline" inheritViewBox>
      <EmailFastOutlineSvg />
    </SvgIcon>
  )
}

// A cave diver's line arrow (a "Dorff" arrow): the notched plastic triangle
// clipped on the guideline, pointing to the exit. Drawn after the real one -
// an isosceles triangle with two slanted slots, from opposite edges, each
// ending in a round hole on the line. Filled with currentColor; the slots and
// holes are cut out (a mask, its id unique per icon).
export function LineArrow({ sx, ...props }) {
  const mask = `oc-line-arrow-${useId().replace(/:/g, '')}`
  return (
    <SvgIcon className="oc-line-arrow" viewBox="0 0 24 24" sx={sx} {...props}>
      <defs>
        <mask id={mask}>
          <path d="M3.5 5.5 L21.5 12 L3.5 18.5 Z" fill="#fff" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
          <path d="M10.6 4.8 L8.6 12 M12.4 19.2 L14.4 12" stroke="#000" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="8.6" cy="12" r="1.1" fill="#000" />
          <circle cx="14.4" cy="12" r="1.1" fill="#000" />
        </mask>
      </defs>
      <rect width="24" height="24" fill="currentColor" mask={`url(#${mask})`} />
    </SvgIcon>
  )
}

// A cave diver's line cookie: the round plastic marker clipped on the
// guideline, marking a place without pointing anywhere. As the real one, two
// straight slots - from the top and from the bottom - each end in a hole on
// the line. Filled with currentColor; the slots and holes are cut out.
export function LineCookie({ sx, ...props }) {
  const mask = `oc-line-cookie-${useId().replace(/:/g, '')}`
  return (
    <SvgIcon className="oc-line-cookie" viewBox="0 0 24 24" sx={sx} {...props}>
      <defs>
        <mask id={mask}>
          <circle cx="12" cy="12" r="9.5" fill="#fff" />
          <path d="M9.2 1.5 L9.2 12 M14.8 22.5 L14.8 12" stroke="#000" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="9.2" cy="12" r="1.1" fill="#000" />
          <circle cx="14.8" cy="12" r="1.1" fill="#000" />
        </mask>
      </defs>
      <rect width="24" height="24" fill="currentColor" mask={`url(#${mask})`} />
    </SvgIcon>
  )
}
