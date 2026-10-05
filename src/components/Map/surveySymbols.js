// The cave maps' own conventions for their numbers, drawn as images the cave
// layer's symbol layers name ("oc-sym:<kind>:<text>"): a floor depth is an
// overlined number, a ceiling-to-floor height a circled one. The map's fonts
// have no overline or circle, so each is drawn on a canvas the first time
// the map asks for it (styleimagemissing).
const PREFIX = 'oc-sym:'
const PIXEL_RATIO = 2
const FONT_PX = 11
const FONT = `600 ${FONT_PX}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
const TEXT = '#fff'
const HALO = 'rgba(0, 0, 0, 0.75)'

export const surveySymbolImage = (kind, text) => ['concat', PREFIX + kind + ':', text]

function draw(kind, text) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.font = FONT
  const textWidth = Math.ceil(ctx.measureText(text).width)
  const pad = 3
  const circled = kind === 'height'
  const size = circled ? Math.max(textWidth, FONT_PX) + 2 * pad + 4 : null
  const width = circled ? size : textWidth + 2 * pad
  const height = circled ? size : FONT_PX + 2 * pad + 4
  canvas.width = width * PIXEL_RATIO
  canvas.height = height * PIXEL_RATIO
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO)
  ctx.font = FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = width / 2
  const cy = circled ? height / 2 : height / 2 + 2
  // A dark halo under every stroke, as the layer's other labels have.
  const stroke = (paint) => {
    ctx.lineWidth = 3
    ctx.strokeStyle = HALO
    paint()
    ctx.stroke()
    ctx.lineWidth = 1.2
    ctx.strokeStyle = TEXT
    paint()
    ctx.stroke()
  }
  if (circled) {
    stroke(() => {
      ctx.beginPath()
      ctx.arc(cx, cy, size / 2 - 2, 0, 2 * Math.PI)
    })
  } else {
    // The overline, over the digits.
    stroke(() => {
      ctx.beginPath()
      ctx.moveTo(cx - textWidth / 2, pad)
      ctx.lineTo(cx + textWidth / 2, pad)
    })
  }
  ctx.lineWidth = 3
  ctx.strokeStyle = HALO
  ctx.strokeText(text, cx, cy)
  ctx.fillStyle = TEXT
  ctx.fillText(text, cx, cy)
  return { width: canvas.width, height: canvas.height, data: new Uint8Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer) }
}

// Answers the map's requests for these images; returns the unsubscribe.
export function registerSurveySymbols(map) {
  const onMissing = ({ id }) => {
    if (!id?.startsWith(PREFIX) || map.hasImage(id)) return
    const [kind, ...rest] = id.slice(PREFIX.length).split(':')
    map.addImage(id, draw(kind, rest.join(':')), { pixelRatio: PIXEL_RATIO })
  }
  map.on('styleimagemissing', onMissing)
  return () => map.off('styleimagemissing', onMissing)
}
