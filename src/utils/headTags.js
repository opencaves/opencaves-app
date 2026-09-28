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
