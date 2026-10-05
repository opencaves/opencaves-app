// Kept identical to src/utils/slug.js: the app builds the same
// area addresses (/areas/<slug>), so the two must agree on every name.

// A name as it appears in an address: lowercase, accents and apostrophes
// dropped, anything else not a letter or digit a single "-".
export function slugify(name) {
  return String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
