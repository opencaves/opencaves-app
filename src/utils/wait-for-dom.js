/**
 * The first element matching selector, once it's in the page (at once if it
 * already is).
 *
 * @param {string} selector
 * @param {object} [options]
 * @param {Element|string|null} [options.root=null] - Where to look (an element or a selector); the whole page by default.
 * @param {boolean} [options.timeout=false] - Whether to give up after timeoutDelay.
 * @param {number} [options.timeoutDelay=5000] - In ms.
 * @returns {Promise<Element>}
 * @throws {Error} 'timeout' when it gave up (the promise rejects), or for a bad selector or root.
 */
export default function waitForDom(selector, { root = null, timeout = false, timeoutDelay = 5000 } = {}) {
  return new Promise((resolve, reject) => {

    if (typeof selector !== 'string') {
      return reject(new Error('selector must be a string'))
    }

    if (root === null) {
      root = document.documentElement
    }

    if (typeof root === 'string') {
      root = document.querySelector(root)
    }

    if (!(root instanceof Element)) {
      return reject(new Error('root must be a string or a DOM Element'))
    }

    const element = root.querySelector(selector)
    let timeoutHandle

    if (element) {
      resolve(element)
      return
    }

    // The observer itself (observe() returns nothing): disconnected once the
    // element is there, or at the timeout.
    const scope = root
    const observer = new MutationObserver(() => {
      const found = scope.querySelector(selector)
      if (!found) return
      observer.disconnect()
      clearTimeout(timeoutHandle)
      resolve(found)
    })
    observer.observe(scope, { childList: true, subtree: true })

    if (timeout) {
      timeoutHandle = setTimeout(() => {
        observer.disconnect()
        reject(new Error('timeout'))
      }, timeoutDelay)
    }
  })
}