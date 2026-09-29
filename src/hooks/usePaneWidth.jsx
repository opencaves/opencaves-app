import { PANE_WIDTH } from '@/config/app'
import { useSmall } from './useSmall'

export default function usePaneWidth() {
  const isSmall = useSmall()

  return isSmall ? window.innerWidth : PANE_WIDTH
}