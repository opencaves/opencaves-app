import { Tooltip as MUITooltip } from '@mui/material'
import { useSmall } from '@/hooks/useSmall'
import ConditionalWrapper from '@/components/utils/ConditionalWrapper'

export default function Tooltip({ children, ...props }) {
  const isSmall = useSmall()

  return (
    <ConditionalWrapper
      condition={!isSmall}
      wrapper={children => <MUITooltip {...props}><>{children}</></MUITooltip>}
    >
      {children}
    </ConditionalWrapper>
  )
}