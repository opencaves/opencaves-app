/**
 * A file's SHA-256, as 64 lowercase hexadecimal digits (a survey map's
 * `contentHash`: the same file uploaded twice has the same one). Null where
 * the browser can't (crypto.subtle needs a secure context: https or localhost).
 *
 * @param {Blob} file
 * @returns {Promise<string|null>}
 */
export async function sha256Hex(file) {
  if (!globalThis.crypto?.subtle) return null
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
