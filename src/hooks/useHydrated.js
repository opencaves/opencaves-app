import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * false on the server and while a server-rendered page is hydrated
 * (index.jsx), true otherwise (React renders again with true right after a
 * hydration). For what the server can't know (the browser's language,
 * region, screen...): the server's value until then, so the browser's first
 * render is the server's.
 *
 * @returns {boolean}
 */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
