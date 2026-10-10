// The web components the app renders in JSX, and the CSS custom properties
// its style props set - for the type checker only
// (npm run typecheck): Swiper's elements (the sign-up steps) and the app's
// <oc-relative-time> (components/RelativeTime/relativeTimeElement.js).

import 'react'

/** A custom element's props: an HTML element's, plus its own attributes. */
type CustomElementProps = import('react').DetailedHTMLProps<import('react').HTMLAttributes<HTMLElement>, HTMLElement> & {
  [attribute: `${string}-${string}`]: unknown
  /** Swiper's transition, in milliseconds. */
  speed?: string
  className?: string
}

declare module 'react' {
  // CSS custom properties in a style prop (style={{ '--oc-...': value }}).
  interface CSSProperties {
    [property: `--${string}`]: string | number | undefined
  }

  namespace JSX {
    interface IntrinsicElements {
      'swiper-container': CustomElementProps
      'swiper-slide': CustomElementProps
      'oc-relative-time': CustomElementProps & { datetime?: string; lang?: string; focusable?: string }
    }
  }
}
