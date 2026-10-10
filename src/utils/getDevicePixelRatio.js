/**
 * The screen's device pixel ratio (1 where the browser doesn't give one).
 *
 * @returns {number}
 */
export default function getDevicePixelRatio() {
  return window.devicePixelRatio || 1
}
