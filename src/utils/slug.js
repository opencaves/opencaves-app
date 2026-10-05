// Kept identical to functions/js/seo/slug.js: the server renders the same
// area addresses (/areas/<slug>) for search engines, so the two
// must agree on every name.

// A name as it appears in an address: lowercase, accents and apostrophes
// dropped, anything else not a letter or digit a single "-".
export function slugify(name) {
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
