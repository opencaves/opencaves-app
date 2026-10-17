// Single-instance <head> tags (description, robots, canonical), updated in
// place. Under React 19, react-helmet-async just renders plain <meta>/<link>
// elements that React hoists into <head> without de-duplicating, so every
// component setting a description would add another tag - these keep exactly
// one of each (reusing index.html's static description, which crawlers that
// don't run JS still see).

export function setHeadMeta(name, content) {
  let el = document.head.querySelector(`meta[name="${name}"]`)
  if (content == null) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function setHeadLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (href == null) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * A <meta property="..."> tag (Open Graph's og:*), set, added or - content
 * null - removed, as {@link setHeadMeta}.
 *
 * @param {string} property
 * @param {string|number|null} content
 */
export function setHeadProperty(property, content) {
  let el = document.head.querySelector(`meta[property="${property}"]`)
  if (content == null) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', String(content))
}

/**
 * The page's share image (og:image, its size and alt text), the tags the
 * server renders for it (functions/js/seo/shared.js' pageHead).
 *
 * @param {{url: string, width: number, height: number, alt: string}} image
 */
export function setShareImage(image) {
  setHeadProperty('og:image', image.url)
  setHeadProperty('og:image:width', image.width)
  setHeadProperty('og:image:height', image.height)
  setHeadProperty('og:image:alt', image.alt)
}
