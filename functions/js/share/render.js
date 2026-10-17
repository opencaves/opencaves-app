// The share images' pictures (og:image, shareImages.js): 1200 x 630 JPEGs, the
// size Facebook, WhatsApp, X and LinkedIn all show whole. Two kinds:
// - a cave's cover photo, cropped to that size;
// - a map card: the app's own Mapbox style (the Static Images API) centred on
//   a cave or a system, its pins drawn as the app's (pin.svg, in the system's
//   colour), the OpenCaves logo in a corner and a band across the bottom with
//   the name - readable down to WhatsApp's small preview.
// The text is drawn with the Roboto files in ./assets (sharp's text input with
// its own font file, so it looks the same on any machine: Cloud Functions has
// hardly any fonts). Nothing here reads Firestore or Storage: the backfill
// script (scripts/share-images.js) uses it too.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { MAP_STYLE } from '../constants.js'

export const SHARE_WIDTH = 1200
export const SHARE_HEIGHT = 630

// The JPEGs' quality: text and pins stay crisp (no chroma subsampling) at
// about 100-250 KB - WhatsApp skips images much past 300 KB.
const SHARE_JPEG = { quality: 84, mozjpeg: true, chromaSubsampling: '4:4:4' }

const asset = (name) => fileURLToPath(new URL(`./assets/${name}`, import.meta.url))
const SHARE_FONT_MEDIUM = asset('Roboto-Medium.ttf')
const SHARE_FONT_REGULAR = asset('Roboto-Regular.ttf')
// Copies of the app's (src/images/map/pin.svg, pin-location-unknown.svg,
// src/images/logo/brand-short_light.svg): keep them in step.
const SHARE_PIN_SVG = readFileSync(asset('pin.svg'), 'utf8')
const SHARE_PIN_UNKNOWN_SVG = readFileSync(asset('pin-location-unknown.svg'), 'utf8')
const SHARE_LOGO_SVG = readFileSync(asset('brand-short_light.svg'))

// The Static Images API draws at most 1280 px a side; @2x: 600 x 315 drawn
// at twice the density, 1200 x 630.
const SHARE_MAP_SCALE = 2
// The style's owner and id (mapbox://styles/<owner>/<id>).
const [SHARE_STYLE_OWNER, SHARE_STYLE_ID] = MAP_STYLE.replace('mapbox://styles/', '').split('/')

// The band across the bottom.
const SHARE_BAND = { color: { r: 16, g: 20, b: 24, alpha: 0.8 }, padX: 48, titleSize: 56, titleMinSize: 42, subtitleSize: 30 }

/**
 * The relative luminance of a "#rgb"/"#rrggbb" colour (WCAG), or null.
 *
 * @param {string} color
 * @returns {number|null}
 */
function luminance(color) {
  const hex = String(color || '').trim().replace(/^#/, '')
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// The pin's glyph: black on light pins, as the app's (src/utils/pinGlyphColor.js).
const glyphColor = (color) => ((luminance(color) ?? 0) > 0.4 ? '#000' : '#fff')

// A colour the SVG can take as it is, else the app's default pin white.
const safeColor = (color) => (luminance(color) == null ? '#fff' : color)

// The pin's viewBox (pin.svg: 20 x 28.15) with room for its shadow; its tip
// is at (10, 27.9) in the pin's own units.
const SHARE_PIN_BOX = { x: -3, y: -3, width: 26, height: 34 }
const SHARE_PIN_TIP = { x: 10, y: 27.9 }

/**
 * A pin as the app draws it - its system's colour, its glyph black or white,
 * a white edge as the open cave's - with a soft shadow, as a PNG `height`
 * pixels high, and where its tip is in that image.
 *
 * @param {object} pin
 * @param {string} [pin.color] - "#rrggbb"; none: the app's default white.
 * @param {boolean} [pin.unknown=false] - Its position isn't confirmed (pin-location-unknown.svg).
 * @param {number} pin.height
 * @param {boolean} [pin.highlight=false] - The white edge of the app's open cave.
 * @returns {Promise<{input: Buffer, width: number, height: number, tipX: number, tipY: number}>}
 */
export async function renderPin({ color, unknown = false, height, highlight = false }) {
  const fill = safeColor(color)
  const scale = height / SHARE_PIN_BOX.height
  const width = Math.round(SHARE_PIN_BOX.width * scale)
  const inner = (unknown ? SHARE_PIN_UNKNOWN_SVG : SHARE_PIN_SVG)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    // Its colour, and the glyph's (pin.svg's group, #fff in the file).
    .replace('fill="currentColor" stroke="#23272b"', `fill="${fill}" stroke="${highlight ? 'rgba(255,255,255,0.9)' : '#23272b'}"`)
    .replace('<g color="#fff"', `<g color="${glyphColor(fill)}"`)
    .replace(/<path fill="#fff" transform="translate\(0 2\.3\)"/, `<path fill="${glyphColor(fill)}" transform="translate(0 2.3)"`)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${SHARE_PIN_BOX.x} ${SHARE_PIN_BOX.y} ${SHARE_PIN_BOX.width} ${SHARE_PIN_BOX.height}">
<defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation="0.7"/><feOffset dx="0.3" dy="0.6"/><feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<g filter="url(#s)">${inner}</g></svg>`
  const input = await sharp(Buffer.from(svg)).png().toBuffer()
  return { input, width, height, tipX: (SHARE_PIN_TIP.x - SHARE_PIN_BOX.x) * scale, tipY: (SHARE_PIN_TIP.y - SHARE_PIN_BOX.y) * scale }
}

// Text for Pango's markup.
const markup = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function textImage(text, { size, medium = false, color = '#ffffff' }) {
  const { data, info } = await sharp({
    text: {
      text: `<span foreground="${color}">${markup(text)}</span>`,
      fontfile: medium ? SHARE_FONT_MEDIUM : SHARE_FONT_REGULAR,
      font: `Roboto${medium ? ' Medium' : ''} ${size}`,
      // 72 dpi: a point is a pixel.
      dpi: 72,
      rgba: true,
    },
  }).png().toBuffer({ resolveWithObject: true })
  return { input: data, width: info.width, height: info.height }
}

/**
 * One line of text as an image no wider than maxWidth: smaller down to
 * minSize, then cut with an ellipsis.
 *
 * @param {string} text
 * @param {object} options
 * @param {number} options.size
 * @param {number} [options.minSize]
 * @param {number} options.maxWidth
 * @param {boolean} [options.medium=false]
 * @param {string} [options.color]
 * @returns {Promise<{input: Buffer, width: number, height: number}>}
 */
export async function fitText(text, { size, minSize = size, maxWidth, medium = false, color }) {
  let fontSize = size
  let image = await textImage(text, { size: fontSize, medium, color })
  while (image.width > maxWidth && fontSize > minSize) {
    fontSize = Math.max(minSize, Math.floor(fontSize * Math.max(0.8, maxWidth / image.width)))
    image = await textImage(text, { size: fontSize, medium, color })
  }
  if (image.width <= maxWidth) return image
  // Cut by characters (whole code points), the longest that fits.
  const chars = [...text]
  let low = 1
  let high = chars.length - 1
  let best = await textImage('…', { size: fontSize, medium, color })
  while (low <= high) {
    const mid = (low + high) >> 1
    const candidate = await textImage(`${chars.slice(0, mid).join('').trimEnd()}…`, { size: fontSize, medium, color })
    if (candidate.width <= maxWidth) {
      best = candidate
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return best
}

/**
 * Where a point falls in the map picture (Web Mercator, 512-pixel tiles at
 * SHARE_MAP_SCALE), in pixels from its top left.
 *
 * @param {{latitude: number, longitude: number}} point
 * @param {{latitude: number, longitude: number, zoom: number}} view
 * @returns {{x: number, y: number}}
 */
export function project(point, view) {
  const worldSize = 512 * SHARE_MAP_SCALE * 2 ** view.zoom
  const mercator = ({ latitude, longitude }) => {
    const sin = Math.sin((latitude * Math.PI) / 180)
    return { x: ((longitude + 180) / 360) * worldSize, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize }
  }
  const p = mercator(point)
  const c = mercator(view)
  return { x: SHARE_WIDTH / 2 + p.x - c.x, y: SHARE_HEIGHT / 2 + p.y - c.y }
}

/**
 * The view that shows every point inside the picture, clear of its edges
 * and of the band: the centre of their bounds, and the closest zoom (two
 * decimals, as the API takes it) between minZoom and maxZoom.
 *
 * @param {{latitude: number, longitude: number}[]} points
 * @param {object} [options]
 * @param {number} [options.maxZoom=15]
 * @param {number} [options.minZoom=8]
 * @param {{top: number, right: number, bottom: number, left: number}} [options.padding]
 * @returns {{latitude: number, longitude: number, zoom: number}}
 */
export function fitView(points, { maxZoom = 15, minZoom = 8, padding = { top: 110, right: 70, bottom: 200, left: 70 } } = {}) {
  const lats = points.map((p) => p.latitude)
  const lngs = points.map((p) => p.longitude)
  const bounds = { north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lngs), west: Math.min(...lngs) }
  // In Mercator units of a zoom-0 world (512 * SHARE_MAP_SCALE pixels).
  const y = (lat) => {
    const sin = Math.sin((lat * Math.PI) / 180)
    return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)
  }
  const spanX = (bounds.east - bounds.west) / 360
  const spanY = y(bounds.south) - y(bounds.north)
  const world = 512 * SHARE_MAP_SCALE
  const fit = (span, room) => (span > 0 ? Math.log2(room / (span * world)) : Infinity)
  const zoom = Math.min(maxZoom, fit(spanX, SHARE_WIDTH - padding.left - padding.right), fit(spanY, SHARE_HEIGHT - padding.top - padding.bottom))
  const clamped = Math.max(minZoom, Math.floor(zoom * 100) / 100)
  // The bounds' centre, moved so they sit in the room left by the padding
  // (the band takes more of the bottom than the top).
  const centerY = (y(bounds.north) + y(bounds.south)) / 2
  const shiftY = (padding.bottom - padding.top) / 2 / (world * 2 ** clamped)
  const mercatorY = centerY + shiftY
  const latitude = (Math.atan(Math.sinh(Math.PI * (1 - 2 * mercatorY))) * 180) / Math.PI
  return { latitude, longitude: (bounds.east + bounds.west) / 2, zoom: clamped }
}

/**
 * The map's picture at a view, from the Static Images API in the app's
 * style: no logo nor attribution of its own (the card writes the
 * attribution).
 *
 * @param {{latitude: number, longitude: number, zoom: number}} view
 * @param {string} token - A Mapbox token allowed to call it from a server.
 * @returns {Promise<Buffer>}
 * @throws {Error} When Mapbox answers with an error.
 */
export async function fetchMapImage(view, token) {
  const at = `${view.longitude.toFixed(6)},${view.latitude.toFixed(6)},${view.zoom},0`
  const url = `https://api.mapbox.com/styles/v1/${SHARE_STYLE_OWNER}/${SHARE_STYLE_ID}/static/${at}/${SHARE_WIDTH / SHARE_MAP_SCALE}x${SHARE_HEIGHT / SHARE_MAP_SCALE}@${SHARE_MAP_SCALE}x?attribution=false&logo=false&access_token=${encodeURIComponent(token)}`
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  // The message only (the URL carries the token).
  if (!response.ok) throw new Error(`Mapbox Static Images API: ${response.status} ${(await response.text().catch(() => '')).slice(0, 200)}`)
  return Buffer.from(await response.arrayBuffer())
}

// The logo's card, top left: the logo on a white rounded card (the map's
// colours vary under it).
async function logoCard() {
  const logoHeight = 50
  const logo = await sharp(SHARE_LOGO_SVG, { density: 300 }).resize({ height: logoHeight }).png().toBuffer({ resolveWithObject: true })
  const pad = { x: 14, y: 11 }
  const width = logo.info.width + pad.x * 2
  const height = logoHeight + pad.y * 2
  const card = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width + 8}" height="${height + 8}"><defs><filter id="s"><feGaussianBlur in="SourceAlpha" stdDeviation="2"/><feOffset dy="1"/><feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect x="4" y="3" width="${width}" height="${height}" rx="12" fill="#ffffff" fill-opacity="0.94" filter="url(#s)"/></svg>`)
  return [
    { input: card, left: 24 - 4, top: 24 - 3 },
    { input: logo.data, left: 24 + pad.x, top: 24 + pad.y },
  ]
}

// The map data's attribution - the style's satellite imagery and data, as
// the Static Images API writes it - (a light label at the bottom
// right), just above the band.
async function attribution(bandTop) {
  const text = await textImage('© Maxar © Mapbox © OpenStreetMap', { size: 15, color: '#333333' })
  const pad = { x: 8, y: 3 }
  const width = text.width + pad.x * 2
  const height = text.height + pad.y * 2
  const left = SHARE_WIDTH - width - 10
  const top = bandTop - height - 8
  return [
    { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${height / 2}" fill="#ffffff" fill-opacity="0.75"/></svg>`), left, top },
    { input: text.input, left: left + pad.x, top: top + pad.y },
  ]
}

/**
 * A map card: the map at the view, the pins (their tips on their points;
 * the last drawn on top), the logo, and the band with the title and, if
 * any, a smaller subtitle - as a JPEG.
 *
 * @param {object} card
 * @param {{latitude: number, longitude: number, zoom: number}} card.view
 * @param {{latitude: number, longitude: number, color?: string, unknown?: boolean, highlight?: boolean}[]} card.pins
 * @param {number} [card.pinHeight=96]
 * @param {string} card.title
 * @param {string} [card.subtitle]
 * @param {string} card.token - The Mapbox token ({@link fetchMapImage}).
 * @returns {Promise<Buffer>}
 */
export async function renderMapCard({ view, pins, pinHeight = 96, title, subtitle, token }) {
  const map = await fetchMapImage(view, token)
  const maxWidth = SHARE_WIDTH - SHARE_BAND.padX * 2
  const titleImage = await fitText(title, { size: SHARE_BAND.titleSize, minSize: SHARE_BAND.titleMinSize, maxWidth, medium: true })
  const subtitleImage = subtitle ? await fitText(subtitle, { size: SHARE_BAND.subtitleSize, maxWidth, color: '#dfe3e8' }) : null
  const padTop = 24
  const padBottom = 30
  const gap = 4
  const bandHeight = Math.round(padTop + titleImage.height + (subtitleImage ? gap + subtitleImage.height : 0) + padBottom)
  const bandTop = SHARE_HEIGHT - bandHeight

  const pinLayers = []
  for (const pin of pins) {
    const image = await renderPin({ ...pin, height: pinHeight })
    const { x, y } = project(pin, view)
    const left = Math.round(x - image.tipX)
    const top = Math.round(y - image.tipY)
    // Off the picture: left out (sharp refuses an overlay past its edges).
    if (left < 0 || top < 0 || left + image.width > SHARE_WIDTH || top + image.height > SHARE_HEIGHT) continue
    pinLayers.push({ input: image.input, left, top })
  }

  const band = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SHARE_WIDTH}" height="${bandHeight}"><rect width="${SHARE_WIDTH}" height="${bandHeight}" fill="rgb(${SHARE_BAND.color.r},${SHARE_BAND.color.g},${SHARE_BAND.color.b})" fill-opacity="${SHARE_BAND.color.alpha}"/></svg>`)
  const titleTop = bandTop + padTop
  const layers = [
    ...pinLayers,
    ...(await logoCard()),
    ...(await attribution(bandTop)),
    { input: band, left: 0, top: bandTop },
    { input: titleImage.input, left: SHARE_BAND.padX, top: titleTop },
    ...(subtitleImage ? [{ input: subtitleImage.input, left: SHARE_BAND.padX, top: titleTop + titleImage.height + gap }] : []),
  ]
  return sharp(map).resize(SHARE_WIDTH, SHARE_HEIGHT).composite(layers).jpeg(SHARE_JPEG).toBuffer()
}

/**
 * A photo as a share image: cropped to 1200 x 630 around what draws the eye
 * (sharp's attention strategy), as a JPEG.
 *
 * @param {Buffer} photo - Any format sharp reads (the cover's WebP copy).
 * @returns {Promise<Buffer>}
 */
export function renderPhotoCard(photo) {
  return sharp(photo).rotate().resize(SHARE_WIDTH, SHARE_HEIGHT, { fit: 'cover', position: sharp.strategy.attention }).jpeg(SHARE_JPEG).toBuffer()
}
