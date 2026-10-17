import { Box } from '@mui/material'
import './Or.scss'

/**
 * A separator with a word in the middle of its line ("or").
 *
 * @param {object} props - Also a Box's.
 * @param {string} [props.strokeWidth] - Each line's minimum width (2em by default).
 * @param {Sx} [props.sx]
 * @param {React.CSSProperties} [props.style]
 * @param {import('react').ReactNode} props.children - The word.
 * @param {string} [props.className]
 */
export default function Or({ strokeWidth, sx, style, children, className, ...props }) {

  return (
    <Box
      component='span'
      // Its look is Or.scss's; strokeWidth its lines' default width there.
      sx={sx}
      style={strokeWidth ? { '--oc-or-default-width': strokeWidth, ...style } : style}
      className={`oc-or ${className || ''}`.trim()}
      {...props}
    >
      {children}
    </Box>
  )
}
