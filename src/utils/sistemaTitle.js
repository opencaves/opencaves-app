// A name that already says it's a system ("Sistema Ox Bel Ha", "Murena
// system", "Réseau ..."): its title is the name alone - not "Sistema Sistema
// Ox Bel Ha". Kept in step with functions/js/seo/indexPages.js.
const SAYS_SYSTEM = /(^|[^\p{L}])(sistema|system|réseau|reseau)([^\p{L}]|$)/iu

/**
 * A cave system's title: `format(name)` ("Toh Ha system", "Réseau Toh Ha"),
 * or the name alone when it already says it's a system.
 *
 * @param {string} name
 * @param {(name: string) => string} format - The language's title for a system's name.
 * @returns {string}
 */
export function sistemaTitle(name, format) {
  return SAYS_SYSTEM.test(name) ? name : format(name)
}
