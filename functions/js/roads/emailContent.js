import { renderEmail } from '../email/layout.js'

// The admins' email when the monthly roads download failed its last attempt
// (refreshRoadDistances.js), in each admin's language.
const CONTENT = {
  en: {
    subject: 'The road distances could not be refreshed',
    overline: 'Road distances',
    title: 'The roads download failed',
    lead: (attempts) => `OpenStreetMap's roads could not be downloaded from Overpass this month, after ${attempts} attempts. The caves keep the distances measured on the previous roads.`,
    facts: { lastError: 'Last error', roadsOf: 'Roads in use', none: 'none yet' },
    action: 'Run it by hand once Overpass answers again: `node scripts/road-distances.js -p --refresh --write` (see docs/maintenance.md, "Road distances").',
    footer: 'You get this email because you are an OpenCaves admin.',
  },
  fr: {
    subject: 'Les distances aux routes n’ont pas pu être mises à jour',
    overline: 'Distances aux routes',
    title: 'Le téléchargement des routes a échoué',
    lead: (attempts) => `Les routes d’OpenStreetMap n’ont pas pu être téléchargées d’Overpass ce mois-ci, après ${attempts} tentatives. Les grottes gardent les distances mesurées sur les routes précédentes.`,
    facts: { lastError: 'Dernière erreur', roadsOf: 'Routes utilisées', none: 'aucune encore' },
    action: 'Lancez-le à la main quand Overpass répondra de nouveau : `node scripts/road-distances.js -p --refresh --write` (voir docs/maintenance.md, « Road distances »).',
    footer: 'Vous recevez ce courriel parce que vous êtes administrateur d’OpenCaves.',
  },
  es: {
    subject: 'No se pudieron actualizar las distancias a los caminos',
    overline: 'Distancias a los caminos',
    title: 'La descarga de los caminos falló',
    lead: (attempts) => `Los caminos de OpenStreetMap no se pudieron descargar de Overpass este mes, tras ${attempts} intentos. Las cuevas conservan las distancias medidas con los caminos anteriores.`,
    facts: { lastError: 'Último error', roadsOf: 'Caminos en uso', none: 'ninguno aún' },
    action: 'Ejecútalo a mano cuando Overpass vuelva a responder: `node scripts/road-distances.js -p --refresh --write` (ver docs/maintenance.md, «Road distances»).',
    footer: 'Recibes este correo porque eres administrador de OpenCaves.',
  },
}

/**
 * { subject, html, text } of the admins' email about a failed roads
 * download, in `language` (en, fr, es; English for any other).
 *
 * @param {object} email
 * @param {string} email.language
 * @param {number} email.attempts - How many attempts failed this month.
 * @param {string} email.lastError
 * @param {string|null} email.roadsOf - The day of the roads still in use ('YYYY-MM-DD'), null when none.
 * @returns {{subject: string, html: string, text: string}}
 */
export function roadsFailedEmail({ language, attempts, lastError, roadsOf }) {
  const lang = CONTENT[language] ? language : 'en'
  const c = CONTENT[lang]
  const { html, text } = renderEmail({
    language: lang,
    preheader: c.title,
    hero: { overline: c.overline, title: c.title, lead: c.lead(attempts) },
    blocks: [
      { type: 'facts', items: [{ label: c.facts.lastError, value: lastError || '-' }, { label: c.facts.roadsOf, value: roadsOf || c.facts.none }] },
      { type: 'p', text: c.action },
    ],
    footer: c.footer,
  })
  return { subject: c.subject, html, text }
}
