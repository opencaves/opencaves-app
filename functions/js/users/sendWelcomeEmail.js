import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions/v2'
import { auth, db } from '../init.js'
import { ENFORCE_APP_CHECK, REGION, SITE_URL, USERS_COLL_NAME } from '../constants.js'
import { RESEND_API_KEY, sendEmail } from '../email/sendEmail.js'
import { renderEmail } from '../email/layout.js'

// Accounts created before this didn't get it (they joined before it existed):
// no welcome long after the fact.
const WELCOME_SINCE = Date.parse('2026-10-08T00:00:00Z')

// The welcome email: mostly the beta's What can I do? page (/what-can-i-do,
// src/locales' betaTesting) - what to report, what to try, how to report
// well, what's good to know - in the account's language. Its blocks: see
// email/layout.js.
const PAGE = `${SITE_URL}/what-can-i-do`
const ICONS = { bug: '🐞', misleading: '🤔', idea: '💡', explore: '🗺️', edit: '✏️', media: '📷', offline: '📶', everywhere: '📱', reset: '🔄', public: '🌎' }

const CONTENT = {
  en: {
    subject: 'Welcome to OpenCaves (beta)',
    preheader: "You're one of the first divers on OpenCaves. Here's how to help us make it great.",
    overline: 'Beta',
    title: 'Welcome to OpenCaves',
    lead: "The app is in beta, and you're one of its first divers. Use it the way you would before and after a dive, and tell us what breaks, what confuses you and what's missing.",
    greeting: (name) => `Hi${name ? ` ${name}` : ''},`,
    cta: 'Open What can I do?',
    language: ['OpenCaves speaks English, French and Spanish.', 'Choose your language'],
    report: {
      title: 'Tell us',
      lead: 'Send feedback from your account menu in the app, or from the What can I do? page. Every report reaches the OpenCaves team.',
      bug: ['Something broke', "A page that won't load, a button that does nothing, a change that wasn't saved, a photo or a map that won't open."],
      misleading: ['Something is misleading', "A label you don't understand, a feature that doesn't do what it says, data that looks wrong (a position, an access, a depth)."],
      idea: ['Something is missing', 'A feature that would help you plan or share a dive, something you expected to find.'],
    },
    try: {
      title: 'Try everything',
      lead: "Nothing you do in the beta can break anything for good, so poke around.",
      explore: ['Explore', "The map, the cave and system lists, the search, a cave's page.", 'Open the map'],
      edit: ['Edit caves', 'Add one, its coordinates, its access, its texts; correct what looks wrong.', 'See the caves'],
      media: ['Add photos, videos and maps', "From a cave's page: your own photos, a video, a survey map."],
      offline: ['Go offline', 'Install the app, save some caves, use it with no signal.'],
      everywhere: ['Everywhere', 'On your phone and a computer, in light and dark mode, in English, French or Spanish.'],
    },
    tips: { title: 'How to report well', items: ['One report per problem or idea.', 'Say what you did, what you expected, and what happened instead.', 'The page you were on is filled in for you.', 'Your browser is added for you: say which device it is if it matters.'] },
    good: {
      title: 'Good to know',
      reset: ['Beta data can be reset', "What you change now isn't permanent yet."],
      public: ['Everything you add is public', "Don't share anyone's phone number."],
    },
    safety: ['OpenCaves is not for dive planning', 'Cave diving can kill: get trained, dive within your limits, and always check conditions on site.'],
    signoff: ['Thank you for helping,', '**The OpenCaves team**'],
    footer: 'You get this email because you just created an OpenCaves account.',
  },
  fr: {
    subject: 'Bienvenue sur OpenCaves (bêta)',
    preheader: 'Vous êtes parmi les premiers plongeurs sur OpenCaves. Voici comment nous aider à la rendre excellente.',
    overline: 'Bêta',
    title: 'Bienvenue sur OpenCaves',
    lead: "L'application est en bêta, et vous êtes parmi ses premiers plongeurs. Utilisez-la comme vous le feriez avant et après une plongée, et dites-nous ce qui ne marche pas, ce qui vous embrouille et ce qui manque.",
    greeting: (name) => `Bonjour${name ? ` ${name}` : ''},`,
    cta: 'Ouvrir Que puis-je faire ?',
    language: ['OpenCaves parle français, anglais et espagnol.', 'Choisir votre langue'],
    report: {
      title: 'Dites-nous',
      lead: "Envoyez un commentaire depuis le menu de votre compte dans l'application, ou depuis la page Que puis-je faire ?. Chaque rapport parvient à l'équipe d'OpenCaves.",
      bug: ['Quelque chose ne marche pas', 'Une page qui ne s’ouvre pas, un bouton qui ne fait rien, une modification non enregistrée, une photo ou une carte qui ne s’ouvre pas.'],
      misleading: ['Quelque chose est trompeur', 'Un libellé incompris, une fonction qui ne fait pas ce qu’elle dit, une donnée qui semble fausse (une position, un accès, une profondeur).'],
      idea: ['Quelque chose manque', 'Une fonction qui vous aiderait à préparer ou partager une plongée, quelque chose que vous pensiez trouver.'],
    },
    try: {
      title: 'Essayez tout',
      lead: 'Rien de ce que vous faites en bêta ne peut rien casser pour de bon : explorez.',
      explore: ['Explorez', 'La carte, les listes de grottes et de réseaux, la recherche, la page d’une grotte.', 'Ouvrir la carte'],
      edit: ['Modifiez des grottes', 'Ajoutez-en une, ses coordonnées, son accès, ses textes ; corrigez ce qui semble faux.', 'Voir les grottes'],
      media: ['Ajoutez photos, vidéos et cartes', 'Depuis la page d’une grotte : vos photos, une vidéo, une carte topographique.'],
      offline: ['Hors ligne', 'Installez l’application, enregistrez des grottes, utilisez-la sans réseau.'],
      everywhere: ['Partout', 'Sur téléphone et ordinateur, en mode clair et sombre, en anglais, français ou espagnol.'],
    },
    tips: { title: 'Pour un bon rapport', items: ['Un rapport par problème ou par idée.', 'Dites ce que vous avez fait, ce que vous attendiez, et ce qui s’est passé à la place.', 'La page où vous étiez est remplie pour vous.', 'Votre navigateur est ajouté pour vous : précisez l’appareil si cela compte.'] },
    good: {
      title: 'Bon à savoir',
      reset: ['Les données de la bêta peuvent être réinitialisées', 'Ce que vous modifiez n’est pas encore permanent.'],
      public: ['Tout ce que vous ajoutez est public', 'Ne partagez le numéro de téléphone de personne.'],
    },
    safety: ['OpenCaves ne sert pas à planifier une plongée', 'La plongée souterraine peut tuer : formez-vous, plongez selon vos limites, et vérifiez toujours les conditions sur place.'],
    signoff: ['Merci de votre aide,', '**L’équipe d’OpenCaves**'],
    footer: 'Vous recevez ce courriel parce que vous venez de créer un compte OpenCaves.',
  },
  es: {
    subject: 'Bienvenido a OpenCaves (beta)',
    preheader: 'Eres uno de los primeros buzos en OpenCaves. Así puedes ayudarnos a mejorarla.',
    overline: 'Beta',
    title: 'Bienvenido a OpenCaves',
    lead: 'La aplicación está en beta, y tú eres uno de sus primeros buzos. Úsala como lo harías antes y después de una inmersión, y cuéntanos qué falla, qué te confunde y qué falta.',
    greeting: (name) => `Hola${name ? ` ${name}` : ''}:`,
    cta: 'Abrir ¿Qué puedo hacer?',
    language: ['OpenCaves habla español, inglés y francés.', 'Elige tu idioma'],
    report: {
      title: 'Cuéntanos',
      lead: 'Envía comentarios desde el menú de tu cuenta en la aplicación, o desde la página ¿Qué puedo hacer?. Cada reporte llega al equipo de OpenCaves.',
      bug: ['Algo falla', 'Una página que no carga, un botón que no hace nada, un cambio que no se guardó, una foto o un mapa que no se abre.'],
      misleading: ['Algo es engañoso', 'Una etiqueta que no entiendes, una función que no hace lo que dice, un dato que parece erróneo (una posición, un acceso, una profundidad).'],
      idea: ['Algo falta', 'Una función que te ayudaría a preparar o compartir una inmersión, algo que esperabas encontrar.'],
    },
    try: {
      title: 'Pruébalo todo',
      lead: 'Nada de lo que hagas en la beta puede romper algo para siempre: explora.',
      explore: ['Explora', 'El mapa, las listas de cuevas y sistemas, la búsqueda, la página de una cueva.', 'Abrir el mapa'],
      edit: ['Edita cuevas', 'Añade una, sus coordenadas, su acceso, sus textos; corrige lo que parezca erróneo.', 'Ver las cuevas'],
      media: ['Añade fotos, vídeos y mapas', 'Desde la página de una cueva: tus fotos, un vídeo, un mapa topográfico.'],
      offline: ['Sin conexión', 'Instala la aplicación, guarda algunas cuevas, úsala sin señal.'],
      everywhere: ['En todas partes', 'En tu teléfono y en una computadora, en modo claro y oscuro, en inglés, francés o español.'],
    },
    tips: { title: 'Cómo reportar bien', items: ['Un reporte por problema o idea.', 'Di qué hiciste, qué esperabas y qué pasó en cambio.', 'La página en la que estabas se completa sola.', 'Tu navegador se añade solo: indica el dispositivo si importa.'] },
    good: {
      title: 'Bueno saber',
      reset: ['Los datos de la beta pueden reiniciarse', 'Lo que cambies aún no es permanente.'],
      public: ['Todo lo que añades es público', 'No compartas el teléfono de nadie.'],
    },
    safety: ['OpenCaves no sirve para planificar una inmersión', 'El buceo en cuevas puede matar: fórmate, bucea dentro de tus límites y verifica siempre las condiciones en el lugar.'],
    signoff: ['Gracias por tu ayuda,', '**El equipo de OpenCaves**'],
    footer: 'Recibes este correo porque acabas de crear una cuenta en OpenCaves.',
  },
}

const LINKS = { explore: '/map', edit: '/caves' }
const card = (section, key) => {
  const [title, text, linkLabel] = section[key]
  return { icon: ICONS[key], title, text, ...(linkLabel && { link: { label: linkLabel, href: `${SITE_URL}${LINKS[key]}` } }) }
}

/**
 * { subject, html, text } of the welcome email in a language (en, fr, es).
 *
 * @param {string} language
 * @param {string} name
 * @returns {{subject: string, html: string, text: string}}
 */
export function welcomeEmail(language, name) {
  const c = CONTENT[language] || CONTENT.en
  const { html, text } = renderEmail({
    language: CONTENT[language] ? language : 'en',
    preheader: c.preheader,
    hero: { overline: c.overline, title: c.title, lead: c.lead },
    blocks: [
      { type: 'p', text: c.greeting(name) },
      // The language the app (and these emails) speak to them: their account's.
      { type: 'p', text: c.language[0], link: { label: c.language[1], href: `${SITE_URL}/account#language` } },
      { type: 'button', label: c.cta, href: PAGE },
      { type: 'cards', title: c.report.title, lead: c.report.lead, items: ['bug', 'misleading', 'idea'].map((key) => card(c.report, key)) },
      { type: 'cards', title: c.try.title, lead: c.try.lead, items: ['explore', 'edit', 'media', 'offline', 'everywhere'].map((key) => card(c.try, key)) },
      { type: 'steps', title: c.tips.title, items: c.tips.items },
      { type: 'notes', title: c.good.title, items: ['reset', 'public'].map((key) => ({ icon: ICONS[key], title: c.good[key][0], text: c.good[key][1] })) },
      { type: 'warning', title: c.safety[0], text: c.safety[1] },
      { type: 'signoff', lines: c.signoff },
    ],
    footer: c.footer,
  })
  return { subject: c.subject, html, text }
}


/**
 * Called by the app once an account has its editor role (ManageAuth): sends
 * it the welcome email, once - _users/{uid}.welcomeEmailSentAt records it -
 * and only to an account created since {@link WELCOME_SINCE}.
 *
 * @param {CallableRequest} request - Its data's language: the app's.
 * @throws {HttpsError} unauthenticated without an account (anonymous included).
 */
export const sendWelcomeEmail = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK, secrets: [RESEND_API_KEY] }, async (request) => {
  const uid = request.auth?.uid
  if (!uid || request.auth.token.firebase?.sign_in_provider === 'anonymous') throw new HttpsError('unauthenticated', 'An account is needed.')
  const user = await auth.getUser(uid)
  if (!user.email || Date.parse(user.metadata.creationTime) < WELCOME_SINCE) return { sent: false }
  const ref = db.collection(USERS_COLL_NAME).doc(uid)
  // Claimed in a transaction: two calls at once send it once.
  const claimed = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (snapshot.exists && snapshot.data().welcomeEmailSentAt) return false
    transaction.set(ref, { welcomeEmailSentAt: FieldValue.serverTimestamp() }, { merge: true })
    return true
  })
  if (!claimed) return { sent: false }
  const { subject, html, text } = welcomeEmail(String(request.data?.language || '').slice(0, 2), user.displayName?.split(' ')[0] || '')
  try {
    await sendEmail({ to: user.email, subject, html, text })
    return { sent: true }
  } catch (error) {
    // Not sent: unclaimed, so a later sign-in tries again.
    logger.error('[welcome] the email could not be sent', { uid, error: error.message })
    await ref.update({ welcomeEmailSentAt: FieldValue.delete() })
    return { sent: false, retry: true }
  }
})
