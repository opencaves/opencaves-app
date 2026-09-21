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

    const observer = new MutationObserver((mutationRecords, observer) => {
      // Query for elements matching the specified selector
      Array.from(root.querySelectorAll(selector)).forEach((element) => {
        resolve(element)
        //Once we have resolved we don't need the observer anymore.
        observer.disconnect()
      })
    })
      .observe(root, {
        childList: true,
        subtree: true
      })

    if (timeout) {
      timeoutHandle = setTimeout(() => {
        observer.disconnect()
        reject('timeout')
      }, timeoutDelay)
    }
  })
}