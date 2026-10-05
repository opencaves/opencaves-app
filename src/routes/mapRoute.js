// The map page's code (Mapbox included, ~1.8 MB), loaded when /map is opened
// rather than by every page - the landing page and the index pages don't
// need it. The router loads it through these; pages that lead to the map
// prefetch it once they've painted (prefetchMap), so opening it stays quick.
export const loadMap = () => import('@/routes/Map.jsx')
export const loadResultPane = () => import('@/components/ResultPane/ResultPane.jsx')

let prefetched = false

// The map's code fetched in the background, when the browser is idle.
export function prefetchMap() {
  if (prefetched) return
  prefetched = true
  const start = () => {
    loadMap().catch(() => (prefetched = false))
    loadResultPane().catch(() => {})
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 4000 })
  else window.setTimeout(start, 2000)
}
