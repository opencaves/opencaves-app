import { useSelector } from 'react-redux'
import { resolveUnits } from '@/utils/units.js'
import { useHydrated } from './useHydrated.js'

/**
 * The person's unit system, 'metric' or 'imperial' (Automatic resolved -
 * from the browser's region: metric on the server and while its page
 * hydrates, {@link useHydrated}).
 *
 * @returns {'metric'|'imperial'}
 */
export function useUnits() {
  const choice = useSelector((state) => state.preferences?.units)
  const hydrated = useHydrated()
  return hydrated ? resolveUnits(choice) : 'metric'
}
