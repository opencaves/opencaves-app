import sharp from 'sharp'

// A map's visual fingerprint (its `visualHash`): a 64-bit difference hash
// ("dHash") - the picture in grey, shrunk to 9 x 8 pixels, each bit saying
// whether a pixel is brighter than the one on its right. Two files of the same
// map (another scan, another size or format, a JPEG of a PNG) come out a few
// bits apart; two different maps about half the bits apart. Drawn from the
// map's thumbnail (maps/derived/<id>_thumb.webp: an image's, an SVG's or a
// PDF's first page, as the server makes them in onUploaded.js), so every kind
// of map is hashed the same way, and scripts/map-content-hashes.js can hash the
// maps made before it from their thumbnails. No imports from init.js: the
// script imports this file.

// Hashes this many bits apart or fewer: possibly the same map
// (onMapTaskWritten's possible duplicates). dHash's usual threshold for "the
// same picture" is about 10 of 64.
export const VISUAL_HASH_MAX_DISTANCE = 10

/**
 * The picture's 64-bit difference hash, as 16 hexadecimal digits. Transparent
 * parts (an SVG's background) count as white.
 *
 * @param {Buffer} input - An image sharp reads (the map's WebP thumbnail).
 * @returns {Promise<string>}
 */
export async function visualHash(input) {
  const pixels = await sharp(input).flatten({ background: '#ffffff' }).grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer()
  let hash = 0n
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      hash = (hash << 1n) | (pixels[y * 9 + x] > pixels[y * 9 + x + 1] ? 1n : 0n)
    }
  }
  return hash.toString(16).padStart(16, '0')
}

/**
 * How many bits two {@link visualHash} values differ by (0 to 64).
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function hammingDistance(a, b) {
  let diff = BigInt(`0x${a}`) ^ BigInt(`0x${b}`)
  let count = 0
  while (diff) {
    count += Number(diff & 1n)
    diff >>= 1n
  }
  return count
}
