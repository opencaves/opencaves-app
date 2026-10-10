// A map's files in Storage (functions/js/maps/onUploaded.js): its original
// (maps/{mapId}, or maps/original-pdf/{mapId} for a PDF), its derived WebP
// copies (maps/derived/) and a PDF's SVG pages (maps/{svgId}).
const ID = /^[-_A-Za-z0-9]{1,64}$/

/**
 * The original's path, from its download link (`url`) when it's one of ours.
 *
 * @param {string} mapId
 * @param {CaveMap} [data={}] - The map's record.
 * @returns {string[]}
 */
export function mapOriginalPaths(mapId, data = {}) {
  const fromUrl = /\/o\/([^?#]+)/.exec(data.url || '')?.[1]
  const urlPath = fromUrl ? decodeURIComponent(fromUrl) : null
  if (urlPath && /^maps\/(original-pdf\/)?[-_A-Za-z0-9]{1,64}$/.test(urlPath)) return [urlPath]
  return [`maps/${mapId}`, `maps/original-pdf/${mapId}`]
}

/**
 * Every path a map's files may have in Storage.
 *
 * @param {string} mapId
 * @param {CaveMap} [data={}] - The map's record.
 * @returns {string[]}
 */
export function mapFilePaths(mapId, data = {}) {
  if (!ID.test(mapId)) return []
  const svgIds = (Array.isArray(data.svgIds) ? data.svgIds : []).filter((id) => typeof id === 'string' && ID.test(id))
  return [
    `maps/${mapId}`,
    `maps/original-pdf/${mapId}`,
    `maps/derived/${mapId}_view.webp`,
    `maps/derived/${mapId}_thumb.webp`,
    ...svgIds.map((id) => `maps/${id}`),
  ]
}
