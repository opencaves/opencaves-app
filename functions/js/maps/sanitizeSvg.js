import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

let purify

// DOMPurify on a jsdom window, made on first use: only SVG uploads need it.
function getPurify() {
  if (!purify) {
    purify = createDOMPurify(new JSDOM('').window)
    // Links only inside the file (#id) or to embedded images (data:image/):
    // never another site - a map opened on its own would load or open it.
    purify.addHook('afterSanitizeAttributes', (node) => {
      for (const name of ['href', 'xlink:href']) {
        const value = node.getAttribute(name)
        if (value !== null && !/^\s*(#|data:image\/)/i.test(value)) node.removeAttribute(name)
      }
    })
  }
  return purify
}

// The XML declaration and doctype, which the parser would keep as text.
const PROLOG = /^\uFEFF?\s*(<\?xml[^>]*\?>\s*)?(<!DOCTYPE[^>[]*(\[[^\]]*\])?\s*>\s*)?/i

// An uploaded SVG without anything that can run code or reach outside it:
// scripts, event attributes (onload=...), javascript: links, embedded web
// content (foreignObject), outside references. The drawing itself (paths,
// text, styles, filters, embedded images) is kept as it was.
export function sanitizeSvg(svg) {
  const clean = getPurify().sanitize(String(svg).replace(PROLOG, ''), {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Embedded images and reused shapes: safe, their links confined by the
    // hook above (PDF pages are drawn with them).
    ADD_TAGS: ['image', 'use'],
    ADD_ATTR: ['href', 'xlink:href'],
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n${clean}`
}
