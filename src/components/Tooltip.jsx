import { Tooltip as MUITooltip } from '@mui/material'
import { useSmall } from '@/hooks/useSmall.jsx'
import ConditionalWrapper from '@/components/utils/ConditionalWrapper.jsx'

export default function Tooltip({ children, className, ...props }) {
  const isSmall = useSmall()

  return (
    <ConditionalWrapper
      condition={!isSmall}
      wrapper={children => <MUITooltip className={`oc-tooltip ${className || ''}`.trim()} {...props}>{children}</MUITooltip>}
    >
      {children}
    </ConditionalWrapper>
  )
}