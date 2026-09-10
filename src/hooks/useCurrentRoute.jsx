import { useMatches } from 'react-router-dom'

export default function useCurrentRoute() {
  const matches = useMatches()

  return matches[matches.length - 1]
}