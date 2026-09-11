import { SvgIcon } from '@mui/material'
import NavigateNextRoundedSvg from '@/images/icons/navigate-next-rounded.svg?react'
import EmailFastOutlineSvg from '@/images/icons/email-fast-outline.svg?react'

export function NavigateNextRounded() {
  return (
    <SvgIcon inheritViewBox>
      <NavigateNextRoundedSvg />
    </SvgIcon>
  )
}

export function EmailFastOutline() {
  return (
    <SvgIcon inheritViewBox>
      <EmailFastOutlineSvg />
    </SvgIcon>
  )
}
