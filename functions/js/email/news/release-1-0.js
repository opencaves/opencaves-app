import { SITE_URL } from '../../constants.js'
import { renderEmail } from '../layout.js'

// The news email announcing OpenCaves 1.0 to the registered accounts (sent
// once, by scripts/send-news.js): out of beta, and everyone can now
// contribute. Its id names it in each account's newsSent.
export const ID = 'release-1-0'

const WHAT_CAN_I_DO = `${SITE_URL}/what-can-i-do`

const CONTENT = {
  en: {
    subject: 'OpenCaves 1.0 is here, and you can now contribute',
    preheader: 'OpenCaves is out of beta, and every member can now improve it.',
    overline: 'News from OpenCaves',
    title: 'OpenCaves 1.0 is here',
    lead: 'And you can now contribute.',
    greeting: (name) => (name ? `Hi ${name},` : 'Hi,'),
    intro: 'You signed up for OpenCaves while it was in beta - thank you! OpenCaves 1.0 is out, and the biggest news is that **you can now contribute**: OpenCaves is open data, and every member can improve it.',
    contributeTitle: 'How you can contribute',
    contribute: [
      { icon: '✏️', title: 'Edit a cave', text: 'Fix or complete its access, fees, directions, description or position on the map. Every change shows in What’s new, and the team can undo a mistake.' },
      { icon: '📷', title: 'Add photos, videos and survey maps', text: 'Share them on the caves you’ve dived.' },
      { icon: '✅', title: 'Still accurate?', text: 'At the foot of each part of a cave’s page, confirm that what it says is still true.' },
      { icon: '🔔', title: 'What changed?', text: 'Next to that button, say that a cave’s access, fees or road changed. The team checks it and updates the cave.' },
    ],
    startHere: 'Not sure where to start? What can I do? lists the caves that need help most.',
    button: 'What can I do?',
    newTitle: 'What’s new since the beta began',
    news: [
      { icon: '🗺️', title: 'A page for every cave and cave system', text: 'With photos, videos and survey maps, and the caves nearby.' },
      { icon: '🧭', title: 'Directions', text: 'The Directions button plans the route through the cave’s entrance to its parking, in Google Maps.' },
      { icon: '📶', title: 'Works offline', text: 'For trips with no signal, and it installs on your phone like an app.' },
      { icon: '🌊', title: 'More cave-system data', text: '82 new systems and newer lengths from the Quintana Roo Speleological Survey.' },
      { icon: '💬', title: 'Feedback that answers back', text: 'A Feedback button on every page: the team replies by email, and you can answer.' },
      { icon: '🆕', title: 'What’s new', text: 'See what changed, cave by cave.' },
      { icon: '⚡', title: 'Easier and faster', text: 'A guided tour (Take the tours, in the menu), search in the top bar, dark mode, and much quicker pages.' },
    ],
    reply: 'Something wrong, or an idea? Just reply to this email: it reaches the team.',
    signoff: ['See you underground,', 'The OpenCaves team'],
    footer: 'You’re getting this because you have an OpenCaves account.',
    unsubscribe: 'Stop news emails',
  },
  fr: {
    subject: 'OpenCaves 1.0 est là, et vous pouvez maintenant contribuer',
    preheader: 'OpenCaves sort de la bêta, et chaque membre peut maintenant l’améliorer.',
    overline: 'Nouvelles d’OpenCaves',
    title: 'OpenCaves 1.0 est là',
    lead: 'Et vous pouvez maintenant contribuer.',
    greeting: (name) => (name ? `Bonjour ${name},` : 'Bonjour,'),
    intro: 'Vous avez créé votre compte OpenCaves pendant la bêta : merci ! OpenCaves 1.0 est sorti, et la grande nouvelle, c’est que **vous pouvez maintenant contribuer** : OpenCaves est fait de données ouvertes, et chaque membre peut l’améliorer.',
    contributeTitle: 'Comment contribuer',
    contribute: [
      { icon: '✏️', title: 'Modifier une grotte', text: 'Corrigez ou complétez son accès, ses frais, son itinéraire, sa description ou sa position sur la carte. Chaque modification apparaît dans Nouveautés, et l’équipe peut annuler une erreur.' },
      { icon: '📷', title: 'Ajouter des photos, des vidéos et des cartes', text: 'Partagez-les sur les grottes où vous avez plongé.' },
      { icon: '✅', title: 'Toujours exact ?', text: 'Au pied de chaque partie de la page d’une grotte, confirmez que ce qu’elle dit est encore vrai.' },
      { icon: '🔔', title: 'Qu’est-ce qui a changé ?', text: 'À côté de ce bouton, signalez que l’accès, les frais ou la route d’une grotte ont changé. L’équipe vérifie et met la grotte à jour.' },
    ],
    startHere: 'Vous ne savez pas par où commencer ? Que puis-je faire ? liste les grottes qui ont le plus besoin d’aide.',
    button: 'Que puis-je faire ?',
    newTitle: 'Les nouveautés depuis le début de la bêta',
    news: [
      { icon: '🗺️', title: 'Une page pour chaque grotte et chaque réseau', text: 'Avec ses photos, ses vidéos et ses cartes, et les grottes voisines.' },
      { icon: '🧭', title: 'Itinéraire', text: 'Le bouton Itinéraire trace la route jusqu’au stationnement de la grotte, par son entrée, dans Google Maps.' },
      { icon: '📶', title: 'Fonctionne hors ligne', text: 'Pour les voyages sans réseau, et s’installe sur votre téléphone comme une application.' },
      { icon: '🌊', title: 'Plus de données sur les réseaux', text: '82 nouveaux réseaux et des longueurs à jour, du Quintana Roo Speleological Survey.' },
      { icon: '💬', title: 'Des commentaires qui ont une réponse', text: 'Un bouton Commentaires sur chaque page : l’équipe répond par courriel, et vous pouvez lui répondre.' },
      { icon: '🆕', title: 'Nouveautés', text: 'Voyez ce qui a changé, grotte par grotte.' },
      { icon: '⚡', title: 'Plus simple et plus rapide', text: 'Une visite guidée (Faire les visites, dans le menu), la recherche dans la barre du haut, le mode sombre et des pages bien plus rapides.' },
    ],
    reply: 'Une erreur, une idée ? Répondez simplement à ce courriel : il arrive à l’équipe.',
    signoff: ['Au plaisir de vous croiser sous terre,', 'L’équipe d’OpenCaves'],
    footer: 'Vous recevez ce courriel parce que vous avez un compte OpenCaves.',
    unsubscribe: 'Ne plus recevoir les nouvelles',
  },
  es: {
    subject: 'OpenCaves 1.0 ya está aquí, y ahora puedes contribuir',
    preheader: 'OpenCaves sale de la beta, y ahora cada miembro puede mejorarlo.',
    overline: 'Noticias de OpenCaves',
    title: 'OpenCaves 1.0 ya está aquí',
    lead: 'Y ahora puedes contribuir.',
    greeting: (name) => (name ? `Hola ${name}:` : 'Hola:'),
    intro: 'Creaste tu cuenta de OpenCaves durante la beta: ¡gracias! OpenCaves 1.0 ya salió, y la gran noticia es que **ahora puedes contribuir**: OpenCaves son datos abiertos, y cada miembro puede mejorarlo.',
    contributeTitle: 'Cómo contribuir',
    contribute: [
      { icon: '✏️', title: 'Editar una cueva', text: 'Corrige o completa su acceso, costos, cómo llegar, descripción o posición en el mapa. Cada cambio aparece en Novedades, y el equipo puede deshacer un error.' },
      { icon: '📷', title: 'Agregar fotos, videos y mapas', text: 'Compártelos en las cuevas donde has buceado.' },
      { icon: '✅', title: '¿Sigue correcto?', text: 'Al pie de cada parte de la página de una cueva, confirma que lo que dice sigue siendo cierto.' },
      { icon: '🔔', title: '¿Qué cambió?', text: 'Junto a ese botón, avisa que el acceso, los costos o el camino de una cueva cambiaron. El equipo lo revisa y actualiza la cueva.' },
    ],
    startHere: '¿No sabes por dónde empezar? ¿Qué puedo hacer? muestra las cuevas que más necesitan ayuda.',
    button: '¿Qué puedo hacer?',
    newTitle: 'Lo nuevo desde que empezó la beta',
    news: [
      { icon: '🗺️', title: 'Una página para cada cueva y cada sistema', text: 'Con fotos, videos y mapas, y las cuevas cercanas.' },
      { icon: '🧭', title: 'Cómo llegar', text: 'El botón Cómo llegar traza la ruta hasta el estacionamiento de la cueva, por su entrada, en Google Maps.' },
      { icon: '📶', title: 'Funciona sin conexión', text: 'Para los viajes sin señal, y se instala en tu teléfono como una app.' },
      { icon: '🌊', title: 'Más datos de los sistemas', text: '82 sistemas nuevos y longitudes actualizadas, del Quintana Roo Speleological Survey.' },
      { icon: '💬', title: 'Comentarios con respuesta', text: 'Un botón Comentarios en cada página: el equipo responde por correo, y tú puedes contestar.' },
      { icon: '🆕', title: 'Novedades', text: 'Mira qué cambió, cueva por cueva.' },
      { icon: '⚡', title: 'Más fácil y más rápido', text: 'Un recorrido guiado (Hacer los recorridos, en el menú), búsqueda en la barra superior, modo oscuro y páginas mucho más rápidas.' },
    ],
    reply: '¿Algo está mal, o tienes una idea? Solo responde a este correo: le llega al equipo.',
    signoff: ['Nos vemos bajo tierra,', 'El equipo de OpenCaves'],
    footer: 'Recibes este correo porque tienes una cuenta de OpenCaves.',
    unsubscribe: 'Dejar de recibir noticias',
  },
}

/** The languages the email is written in (others get English). */
export const LANGUAGES = Object.keys(CONTENT)

/**
 * The email for one account: its subject, and its html and text versions
 * ({@link renderEmail}).
 *
 * @param {object} email
 * @param {string} [email.language='en'] - The account's app language (others: English).
 * @param {string} [email.name] - The account's first name, for the greeting.
 * @param {string} email.unsubscribeUrl - Its news unsubscribe link.
 * @returns {{subject: string, html: string, text: string}}
 */
export function renderRelease10({ language = 'en', name, unsubscribeUrl }) {
  const lang = CONTENT[language] ? language : 'en'
  const c = CONTENT[lang]
  const { html, text } = renderEmail({
    language: lang,
    preheader: c.preheader,
    hero: { overline: c.overline, title: c.title, lead: c.lead },
    blocks: [
      { type: 'p', text: c.greeting(name) },
      { type: 'p', text: c.intro },
      { type: 'cards', title: c.contributeTitle, items: c.contribute },
      { type: 'p', text: c.startHere },
      { type: 'button', label: c.button, href: WHAT_CAN_I_DO },
      { type: 'notes', title: c.newTitle, items: c.news },
      { type: 'p', text: c.reply },
      { type: 'signoff', lines: c.signoff },
    ],
    footer: c.footer,
    unsubscribe: { text: '', label: c.unsubscribe, href: unsubscribeUrl },
  })
  return { subject: c.subject, html, text }
}
