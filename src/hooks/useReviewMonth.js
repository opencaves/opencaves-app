import { useHydrated } from '@/hooks/useHydrated.js'
import { ssrMonth } from '@/ssr/ssrContext.js'
import { monthOf } from '@/utils/caveReview.js'

/**
 * The month ('YYYY-MM') the caves' confirmations' age is counted in ("Still
 * right?" lines, the Not confirmed recently filter): the server's for a page
 * it rendered until it's hydrated - the browser's first render is the
 * server's, even across a month's end - then the device's.
 *
 * @returns {string}
 */
export function useReviewMonth() {
  const hydrated = useHydrated()
  return (!hydrated && ssrMonth()) || monthOf()
}
