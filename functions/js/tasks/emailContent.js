import { SITE_URL } from '../constants.js'
import { renderEmail } from '../email/layout.js'

// The admins' email about a new map task (mapTasks.js), in each admin's
// language (their account's, _users/{uid}.language): the app's Tasks page
// says the same in its own words (src/locales, `tasks`).
const CONTENT = {
  en: {
    subject: (name, systems) => `New map to process: ${name}${systems ? ` (${systems})` : ''}`,
    subjectExact: (name, systems) => `Identical map uploaded: ${name}${systems ? ` (${systems})` : ''}`,
    overline: 'Map task',
    title: 'A new survey map was added',
    scenarios: {
      exactDuplicate: 'It was uploaded although an identical file is already on OpenCaves.',
      possibleDuplicate: 'It looks like a map already on OpenCaves: check whether it is the same map.',
      newerSurvey: 'Its system is already in the cave layer, from an older survey: this map may update it.',
      alreadyTraced: 'Its system is already in the cave layer, from a survey as recent or more: it may not be needed for the layer.',
      newToLayer: 'Its system is not in the cave layer yet: a map to trace.',
    },
    exactTitle: 'Uploaded although identical',
    exactText: (names) => `The same file is already on OpenCaves as **${names}**.`,
    possibleTitle: 'Possible duplicate',
    possibleText: (names) => `It looks like **${names}**.`,
    traced: (titles) => `In the cave layer: ${titles}.`,
    facts: { map: 'Map', systems: 'System', addedBy: 'Added by', date: 'Map date', none: '-', noSystem: 'Not listed by any system yet' },
    button: 'Open the tasks',
    footer: 'You get this email because you are an OpenCaves admin.',
  },
  fr: {
    subject: (name, systems) => `Nouvelle carte à traiter : ${name}${systems ? ` (${systems})` : ''}`,
    subjectExact: (name, systems) => `Carte identique téléversée : ${name}${systems ? ` (${systems})` : ''}`,
    overline: 'Tâche de carte',
    title: 'Une nouvelle carte topographique a été ajoutée',
    scenarios: {
      exactDuplicate: 'Elle a été téléversée bien qu’un fichier identique soit déjà sur OpenCaves.',
      possibleDuplicate: 'Elle ressemble à une carte déjà sur OpenCaves : vérifiez s’il s’agit de la même.',
      newerSurvey: 'Son système est déjà dans la couche des grottes, d’après un relevé plus ancien : cette carte peut la mettre à jour.',
      alreadyTraced: 'Son système est déjà dans la couche des grottes, d’après un relevé aussi récent ou plus : elle n’est peut-être pas utile à la couche.',
      newToLayer: 'Son système n’est pas encore dans la couche des grottes : une carte à tracer.',
    },
    exactTitle: 'Téléversée bien qu’identique',
    exactText: (names) => `Le même fichier est déjà sur OpenCaves : **${names}**.`,
    possibleTitle: 'Doublon possible',
    possibleText: (names) => `Elle ressemble à **${names}**.`,
    traced: (titles) => `Dans la couche des grottes : ${titles}.`,
    facts: { map: 'Carte', systems: 'Système', addedBy: 'Ajoutée par', date: 'Date de la carte', none: '-', noSystem: 'Encore listée par aucun système' },
    button: 'Ouvrir les tâches',
    footer: 'Vous recevez ce courriel parce que vous êtes administrateur d’OpenCaves.',
  },
  es: {
    subject: (name, systems) => `Nuevo mapa por procesar: ${name}${systems ? ` (${systems})` : ''}`,
    subjectExact: (name, systems) => `Mapa idéntico subido: ${name}${systems ? ` (${systems})` : ''}`,
    overline: 'Tarea de mapa',
    title: 'Se agregó un nuevo mapa topográfico',
    scenarios: {
      exactDuplicate: 'Se subió aunque un archivo idéntico ya está en OpenCaves.',
      possibleDuplicate: 'Se parece a un mapa que ya está en OpenCaves: revisa si es el mismo.',
      newerSurvey: 'Su sistema ya está en la capa de cuevas, de un levantamiento más antiguo: este mapa puede actualizarla.',
      alreadyTraced: 'Su sistema ya está en la capa de cuevas, de un levantamiento igual de reciente o más: quizá no haga falta para la capa.',
      newToLayer: 'Su sistema aún no está en la capa de cuevas: un mapa por trazar.',
    },
    exactTitle: 'Subido aunque es idéntico',
    exactText: (names) => `El mismo archivo ya está en OpenCaves: **${names}**.`,
    possibleTitle: 'Posible duplicado',
    possibleText: (names) => `Se parece a **${names}**.`,
    traced: (titles) => `En la capa de cuevas: ${titles}.`,
    facts: { map: 'Mapa', systems: 'Sistema', addedBy: 'Agregado por', date: 'Fecha del mapa', none: '-', noSystem: 'Aún no aparece en ningún sistema' },
    button: 'Abrir las tareas',
    footer: 'Recibes este correo porque eres administrador de OpenCaves.',
  },
}

/**
 * { subject, html, text } of the admins' email about a new map task, in
 * `language` (en, fr, es; English for any other): the map, its systems, who
 * added it, what the checks found - an identical file or a look-alike first,
 * in a warning - and a link to the Tasks page.
 *
 * @param {object} email
 * @param {string} email.language
 * @param {MapTask} email.task
 * @param {{name?: string, url?: string, previewUrl?: string, date?: string}} email.map
 * @param {string[]} email.systems - The map's systems' names.
 * @param {(mapId: string) => string} email.mapName - A duplicate's name, by its id.
 * @param {string} email.addedBy - Who added the map (a name or an email).
 * @returns {{subject: string, html: string, text: string}}
 */
export function mapTaskEmail({ language, task, map, systems, mapName, addedBy }) {
  const lang = CONTENT[language] ? language : 'en'
  const c = CONTENT[lang]
  const name = map.name || task.mapId
  const systemList = systems.join(', ')
  const exact = task.exactDuplicates || []
  const visual = (task.duplicates || []).filter((id) => !exact.includes(id))
  const href = map.previewUrl || map.url
  const { html, text } = renderEmail({
    language: lang,
    preheader: c.scenarios[task.scenario] || '',
    hero: { overline: c.overline, title: c.title, lead: c.scenarios[task.scenario] },
    blocks: [
      ...(exact.length ? [{ type: 'warning', title: c.exactTitle, text: c.exactText(exact.map(mapName).join('**, **')) }] : []),
      ...(visual.length ? [{ type: 'warning', title: c.possibleTitle, text: c.possibleText(visual.map(mapName).join('**, **')) }] : []),
      {
        type: 'facts',
        items: [
          { label: c.facts.map, value: name, ...(href && { href }) },
          { label: c.facts.systems, value: systemList || c.facts.noSystem },
          { label: c.facts.date, value: map.date || c.facts.none },
          { label: c.facts.addedBy, value: addedBy || c.facts.none },
        ],
      },
      ...(task.tracedMaps?.length ? [{ type: 'p', text: c.traced(task.tracedMaps.map((traced) => [traced.title, traced.date && `(${traced.date})`].filter(Boolean).join(' ')).join(', ')) }] : []),
      { type: 'button', label: c.button, href: `${SITE_URL}/tasks` },
    ],
    footer: c.footer,
  })
  return { subject: (exact.length ? c.subjectExact : c.subject)(name, systemList), html, text }
}
