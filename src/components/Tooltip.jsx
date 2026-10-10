import { Tooltip as MUITooltip } from '@mui/material'
import { useSmall } from '@/hooks/useSmall.jsx'
import ConditionalWrapper from '@/components/utils/ConditionalWrapper.jsx'

/**
 * MUI's Tooltip, except on phones (no hover there): its child alone.
 *
 * @param {import('@mui/material/Tooltip').TooltipProps} props
 */
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