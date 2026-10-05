// Kept identical to functions/js/seo/slug.js: the server renders the same
// addresses (/areas/<slug>, /sistemas/<slug>) for search engines, so the two
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

// Unique slugs for a list of { id, name }: a slug shared by several gets
// "-<id lowercased>" appended on all of them but the first by id order.
export function slugsById(items) {
  const slugs = new Map()
  const taken = new Set()
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const { id, name } of sorted) {
    const slug = slugify(name)
    slugs.set(id, taken.has(slug) ? `${slug}-${String(id).toLowerCase()}` : slug)
    taken.add(slug)
  }
  return slugs
}
