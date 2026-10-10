// Browser globals the app reads that the DOM types don't declare - for the
// type checker only (npm run typecheck).

interface Window {
  /**
   * What a server-rendered page was rendered with (functions/js/seo/shared.js's
   * renderSsrPage), read to hydrate it (src/index.jsx, ssr/ssrContext.js).
   */
  __OC_SSR__?: {
    path?: string
    language?: string
    state?: object
    router?: object
    data?: object
    queries?: Record<string, { id: string; data: object }[]>
  }
}

interface Navigator {
  /** Installed on iOS's home screen (Safari only). */
  standalone?: boolean
  /** The Network Information API (Chromium only). */
  connection?: { saveData?: boolean; type?: string }
}
