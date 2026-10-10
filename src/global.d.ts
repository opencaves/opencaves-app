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
  /**
   * The app's stylesheets added after the first paint (index.html's loader,
   * vite.config.js): settles once they're in (index.jsx renders then).
   */
  __ocAppStylesheets?: Promise<unknown>

  // service-worker.js runs in a ServiceWorkerGlobalScope, its `self`, but is
  // checked with the DOM's types (a Window): the members it uses.
  /** The build's precache manifest (vite-plugin-pwa injects it). */
  __WB_MANIFEST?: { url: string; revision: string | null }[]
  /** ServiceWorkerGlobalScope's: the waiting worker takes over. */
  skipWaiting?: () => Promise<void>
}

interface Navigator {
  /** Installed on iOS's home screen (Safari only). */
  standalone?: boolean
  /** The Network Information API (Chromium only). */
  connection?: EventTarget & { saveData?: boolean; type?: string }
}
