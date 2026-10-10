// The panorama viewers on screen, by photo id, so the media menu can take the
// view one shows as the photo's thumbnail (CaveAsset.setViewThumbnail).
const viewers = new Map()

/**
 * Keeps a photo's panorama viewer, for {@link capturePanoramaView}.
 *
 * @param {string} mediaId
 * @param {object} viewer
 * @returns {() => void} Its removal.
 */
export function registerPanoramaViewer(mediaId, viewer) {
  viewers.set(mediaId, viewer)
  return () => {
    if (viewers.get(mediaId) === viewer) viewers.delete(mediaId)
  }
}

// The longest side of the image sent: the largest view copy is 601 px wide,
// so this leaves room for a sharp crop.
const MAX_SIDE = 1600

/**
 * The view the photo's viewer shows now: { image (base64 JPEG), view: { yaw,
 * pitch, zoom } }, or null when no viewer shows it. The viewer keeps its
 * drawing (preserveDrawingBuffer), so its canvas can be read at any time.
 *
 * @param {string} mediaId
 * @returns {Promise<{image: string, view: {yaw: number, pitch: number, zoom: number}}|null>}
 */
export async function capturePanoramaView(mediaId) {
  const viewer = viewers.get(mediaId)
  const canvas = viewer?.container?.querySelector('canvas')
  if (!canvas?.width || !canvas?.height) return null
  const scale = Math.min(1, MAX_SIDE / Math.max(canvas.width, canvas.height))
  const copy = document.createElement('canvas')
  copy.width = Math.round(canvas.width * scale)
  copy.height = Math.round(canvas.height * scale)
  copy.getContext('2d').drawImage(canvas, 0, 0, copy.width, copy.height)
  const blob = await new Promise((resolve) => copy.toBlob(resolve, 'image/jpeg', 0.9))
  if (!blob) return null
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  const { yaw, pitch } = viewer.getPosition()
  return { image: btoa(binary), view: { yaw, pitch, zoom: viewer.getZoomLevel() } }
}
