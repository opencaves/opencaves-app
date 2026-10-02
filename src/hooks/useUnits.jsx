import { useSelector } from 'react-redux'
import { resolveUnits } from '@/utils/units.js'

// The person's unit system, 'metric' or 'imperial' (Automatic resolved).
export function useUnits() {
  return resolveUnits(useSelector((state) => state.preferences?.units))
}
