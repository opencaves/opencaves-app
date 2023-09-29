import { SvgIcon } from '@mui/material'
import { ReactComponent as NavigateNextRoundedSvg } from '@/images/icons/navigate-next-rounded.svg'
import { ReactComponent as EmailFastOutlineSvg } from '@/images/icons/email-fast-outline.svg'

export function NavigateNextRounded() {
  return <SvgIcon component={NavigateNextRoundedSvg} inheritViewBox />
}

export function EmailFastOutline() {
  return <SvgIcon component={EmailFastOutlineSvg} inheritViewBox />
}