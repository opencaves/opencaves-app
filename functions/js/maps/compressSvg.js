import { gzipSync } from 'node:zlib'
import { logger } from 'firebase-functions/v2'
import { optimize } from 'svgo'

// SVGO's default optimizations minus the ones that can change what's drawn
// or break references, with coordinates kept to 3 decimals: survey maps
// render the same (checked on the 8 maps of 2026-10: 0.04% of pixels at most,
// anti-aliasing), about 40% smaller. SVGO 4 keeps the viewBox by default.
const SVGO_CONFIG = {
  multipass: true,
  floatPrecision: 3,
  plugins: [{
    name: 'preset-default',
    params: {
      overrides: {
        // Ids referenced by <use>, clip paths and gradients stay as they are.
        cleanupIds: false,
        // Merging paths can change how overlapping shapes paint.
        mergePaths: false,
        convertShapeToPath: false,
        inlineStyles: false,
      },
    },
  }],
}

// An SVG made smaller, the drawing unchanged. Never worse than what came in:
// an SVG SVGO can't handle, or doesn't shrink, is kept as it is.
export function minifySvg(svg) {
  const source = String(svg)
  try {
    const { data } = optimize(source, SVGO_CONFIG)
    return data.length < source.length ? data : source
  } catch (error) {
    logger.warn('[minifySvg] SVGO failed, the SVG is kept as it is', { error: error.message })
    return source
  }
}

// Stored gzip-compressed (Content-Encoding: gzip): browsers unzip it as it
// loads, clients that don't accept gzip get it unzipped by Storage, and the
// Admin SDK's download() unzips it. Survey maps shrink about 85% more.
export function gzipSvg(svg) {
  return gzipSync(Buffer.from(svg), { level: 9 })
}
