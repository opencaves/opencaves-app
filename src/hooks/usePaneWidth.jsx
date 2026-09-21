import { paneWidth } from '@/config/app'
import { useSmall } from './useSmall'

export default function usePaneWidth() {
  const isSmall = useSmall()

  return isSmall ? window.innerWidth : paneWidth
}