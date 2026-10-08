import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions/v2'
import { auth, db } from '../init.js'
import { ENFORCE_APP_CHECK, REGION, USERS_COLL_NAME } from '../constants.js'
import { RESEND_API_KEY, sendEmail } from '../email/sendEmail.js'
import { SITE_URL } from '../seo/shared.js'

// Accounts created before this didn't get it (they joined before it existed):
// no welcome long after the fact.
const WELCOME_SINCE = Date.parse('2026-10-08T00:00:00Z')

// The welcome email: mostly the beta's What can I do? page (/what-can-i-do,
// src/locales' betaTesting) - what to report, what to try, how to report
// well, what's good to know - in the account's language.
export const EMAILS = {
  en: {
    subject: 'Welcome to OpenCaves (beta)',
    text: (name) => `Hi${name ? ` ${name}` : ''},

Welcome to OpenCaves! The app is in beta, and you're one of its first divers. Use it the way you'd use it before and after a dive, and tell us what breaks, what confuses you, and what's missing.

TELL US
Send feedback from the app's account menu, or from ${SITE_URL}/what-can-i-do. Every report reaches the OpenCaves team.
- Something broke: a page that won't load, a button that does nothing, a change that wasn't saved, a photo or a map that won't open.
- Something is misleading: a label you don't understand, a feature that doesn't do what it says, data that looks wrong (a position, an access, a depth).
- Something is missing: a feature that would help you plan or share a dive, something you expected to find.

TRY EVERYTHING
Nothing you do in the beta can break anything for good, so poke around:
- Explore the map, the cave and system lists, the search, a cave's page.
- Edit caves: add one, its coordinates, its access, its texts; correct what looks wrong.
- Add photos, videos and survey maps from a cave's page.
- Go offline: install the app, save some caves, use it with no signal.
- Try it on your phone and a computer, in light and dark mode, in English, French or Spanish.

HOW TO REPORT WELL
1. One report per problem or idea.
2. Say what you did, what you expected, and what happened instead.
3. The page you were on is filled in for you.
4. Mention your device and browser.

GOOD TO KNOW
- Beta data can be reset: what you change now isn't permanent yet.
- Everything you add is public: don't share anyone's phone number.
- OpenCaves is not for dive planning. Cave diving can kill: get trained, dive within your limits, and always check conditions on site.

Thank you for helping,
The OpenCaves team
${SITE_URL}`,
  },
  fr: {
    subject: 'Bienvenue sur OpenCaves (bêta)',
    text: (name) => `Bonjour${name ? ` ${name}` : ''},

Bienvenue sur OpenCaves ! L'application est en bêta, et vous êtes parmi ses premiers plongeurs. Utilisez-la comme vous le feriez avant et après une plongée, et dites-nous ce qui ne marche pas, ce qui vous embrouille et ce qui manque.

DITES-NOUS
Envoyez un commentaire depuis le menu de votre compte, ou depuis ${SITE_URL}/what-can-i-do. Chaque rapport parvient à l'équipe d'OpenCaves.
- Quelque chose ne marche pas : une page qui ne s'ouvre pas, un bouton qui ne fait rien, une modification non enregistrée, une photo ou une carte qui ne s'ouvre pas.
- Quelque chose est trompeur : un libellé incompris, une fonction qui ne fait pas ce qu'elle dit, une donnée qui semble fausse (une position, un accès, une profondeur).
- Quelque chose manque : une fonction qui vous aiderait à préparer ou partager une plongée, quelque chose que vous pensiez trouver.

ESSAYEZ TOUT
Rien de ce que vous faites en bêta ne peut rien casser pour de bon : explorez.
- Explorez la carte, les listes de grottes et de réseaux, la recherche, la page d'une grotte.
- Modifiez des grottes : ajoutez-en une, ses coordonnées, son accès, ses textes ; corrigez ce qui semble faux.
- Ajoutez photos, vidéos et cartes topographiques depuis la page d'une grotte.
- Hors ligne : installez l'application, enregistrez des grottes, utilisez-la sans réseau.
- Essayez-la sur téléphone et ordinateur, en mode clair et sombre, en anglais, français ou espagnol.

POUR UN BON RAPPORT
1. Un rapport par problème ou par idée.
2. Dites ce que vous avez fait, ce que vous attendiez, et ce qui s'est passé à la place.
3. La page où vous étiez est remplie pour vous.
4. Indiquez votre appareil et votre navigateur.

BON À SAVOIR
- Les données de la bêta peuvent être réinitialisées : ce que vous modifiez n'est pas encore permanent.
- Tout ce que vous ajoutez est public : ne partagez le numéro de téléphone de personne.
- OpenCaves ne sert pas à planifier une plongée. La plongée souterraine peut tuer : formez-vous, plongez selon vos limites, et vérifiez toujours les conditions sur place.

Merci de votre aide,
L'équipe d'OpenCaves
${SITE_URL}`,
  },
  es: {
    subject: 'Bienvenido a OpenCaves (beta)',
    text: (name) => `Hola${name ? ` ${name}` : ''},

¡Bienvenido a OpenCaves! La aplicación está en beta, y tú eres uno de sus primeros buzos. Úsala como lo harías antes y después de una inmersión, y cuéntanos qué falla, qué te confunde y qué falta.

CUÉNTANOS
Envía comentarios desde el menú de tu cuenta, o desde ${SITE_URL}/what-can-i-do. Cada reporte llega al equipo de OpenCaves.
- Algo falla: una página que no carga, un botón que no hace nada, un cambio que no se guardó, una foto o un mapa que no se abre.
- Algo es engañoso: una etiqueta que no entiendes, una función que no hace lo que dice, un dato que parece erróneo (una posición, un acceso, una profundidad).
- Algo falta: una función que te ayudaría a preparar o compartir una inmersión, algo que esperabas encontrar.

PRUÉBALO TODO
Nada de lo que hagas en la beta puede romper algo para siempre: explora.
- Explora el mapa, las listas de cuevas y sistemas, la búsqueda, la página de una cueva.
- Edita cuevas: añade una, sus coordenadas, su acceso, sus textos; corrige lo que parezca erróneo.
- Añade fotos, vídeos y mapas topográficos desde la página de una cueva.
- Sin conexión: instala la aplicación, guarda algunas cuevas, úsala sin señal.
- Pruébala en tu teléfono y en una computadora, en modo claro y oscuro, en inglés, francés o español.

CÓMO REPORTAR BIEN
1. Un reporte por problema o idea.
2. Di qué hiciste, qué esperabas y qué pasó en cambio.
3. La página en la que estabas se completa sola.
4. Menciona tu dispositivo y navegador.

BUENO SABER
- Los datos de la beta pueden reiniciarse: lo que cambies aún no es permanente.
- Todo lo que añades es público: no compartas el teléfono de nadie.
- OpenCaves no sirve para planificar una inmersión. El buceo en cuevas puede matar: fórmate, bucea dentro de tus límites y verifica siempre las condiciones en el lugar.

Gracias por tu ayuda,
El equipo de OpenCaves
${SITE_URL}`,
  },
}

// Called by the app once an account has its editor role (ManageAuth): sends
// it the welcome email, once - _users/{uid}.welcomeEmailSentAt records it -
// and only to an account created since WELCOME_SINCE. language: the app's.
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
  const email = EMAILS[String(request.data?.language || '').slice(0, 2)] || EMAILS.en
  try {
    await sendEmail({ to: user.email, subject: email.subject, text: email.text(user.displayName?.split(' ')[0] || '') })
    return { sent: true }
  } catch (error) {
    // Not sent: unclaimed, so a later sign-in tries again.
    logger.error('[welcome] the email could not be sent', { uid, error: error.message })
    await ref.update({ welcomeEmailSentAt: FieldValue.delete() })
    return { sent: false, retry: true }
  }
})
