import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions/v2'
import { auth, db } from '../init.js'
import { FEEDBACK_COLL_NAME, REGION, SITE_URL, USERS_COLL_NAME } from '../constants.js'
import { RESEND_API_KEY, sendEmail } from '../email/sendEmail.js'
import { renderEmail } from '../email/layout.js'

// The stages that close a report and tell its author (src/utils/feedback.js'
// FEEDBACK_STATUSES; a duplicate isn't told: the first report's author is).
const TOLD = ['done', 'rejected']

// The authors' emails, in the language they wrote their report in: the
// outcome (here) and the team's replies (onFeedbackReplied).
export const FEEDBACK_EMAIL_CONTENT = {
  en: {
    kinds: { bug: 'bug report', misleading: 'report', idea: 'idea' },
    done: { subject: 'Your OpenCaves feedback was handled', overline: 'Done', title: 'Thank you: it’s done', lead: (kind) => `Your ${kind} was handled by the OpenCaves team.` },
    rejected: { subject: 'About your OpenCaves feedback', overline: 'Closed', title: 'We looked at your feedback', lead: (kind) => `The OpenCaves team looked at your ${kind} and won’t act on it for now.` },
    greeting: (name) => `Hi${name ? ` ${name}` : ''},`,
    yours: 'You wrote:',
    reply: { overline: 'Reply', title: 'The OpenCaves team replied', lead: (kind) => `About your ${kind}.` },
    team: 'The OpenCaves team',
    you: 'You',
    earlier: 'Earlier in this conversation',
    more: 'Keep the reports coming: every one helps.',
    button: 'Send more feedback',
    signoff: ['Thank you for helping,', '**The OpenCaves team**'],
    footer: 'You get this email because you sent feedback from OpenCaves.',
    footerReply: 'You get this email because you sent feedback from OpenCaves. Reply to it to answer the team.',
  },
  fr: {
    kinds: { bug: 'signalement de bogue', misleading: 'signalement', idea: 'idée' },
    done: { subject: 'Votre commentaire OpenCaves a été traité', overline: 'Fait', title: 'Merci : c’est fait', lead: (kind) => `L’équipe d’OpenCaves a traité votre ${kind}.` },
    rejected: { subject: 'À propos de votre commentaire OpenCaves', overline: 'Fermé', title: 'Nous avons examiné votre commentaire', lead: (kind) => `L’équipe d’OpenCaves a examiné votre ${kind} et n’y donnera pas suite pour l’instant.` },
    greeting: (name) => `Bonjour${name ? ` ${name}` : ''},`,
    yours: 'Vous avez écrit :',
    reply: { overline: 'Réponse', title: 'L’équipe d’OpenCaves vous a répondu', lead: (kind) => `À propos de votre ${kind}.` },
    team: 'L’équipe d’OpenCaves',
    you: 'Vous',
    earlier: 'Plus tôt dans cette conversation',
    more: 'Continuez à nous écrire : chaque rapport aide.',
    button: 'Envoyer un autre commentaire',
    signoff: ['Merci de votre aide,', '**L’équipe d’OpenCaves**'],
    footer: 'Vous recevez ce courriel parce que vous avez envoyé un commentaire depuis OpenCaves.',
    footerReply: 'Vous recevez ce courriel parce que vous avez envoyé un commentaire depuis OpenCaves. Répondez-y pour écrire à l’équipe.',
  },
  es: {
    kinds: { bug: 'reporte de error', misleading: 'reporte', idea: 'idea' },
    done: { subject: 'Tu comentario en OpenCaves fue atendido', overline: 'Hecho', title: 'Gracias: ya está hecho', lead: (kind) => `El equipo de OpenCaves atendió tu ${kind}.` },
    rejected: { subject: 'Sobre tu comentario en OpenCaves', overline: 'Cerrado', title: 'Revisamos tu comentario', lead: (kind) => `El equipo de OpenCaves revisó tu ${kind} y por ahora no actuará al respecto.` },
    greeting: (name) => `Hola${name ? ` ${name}` : ''}:`,
    yours: 'Escribiste:',
    reply: { overline: 'Respuesta', title: 'El equipo de OpenCaves te respondió', lead: (kind) => `Sobre tu ${kind}.` },
    team: 'El equipo de OpenCaves',
    you: 'Tú',
    earlier: 'Antes en esta conversación',
    more: 'Sigue enviándonos tus reportes: cada uno ayuda.',
    button: 'Enviar otro comentario',
    signoff: ['Gracias por tu ayuda,', '**El equipo de OpenCaves**'],
    footer: 'Recibes este correo porque enviaste un comentario desde OpenCaves.',
    footerReply: 'Recibes este correo porque enviaste un comentario desde OpenCaves. Respóndelo para escribirle al equipo.',
  },
}

// { subject, html, text } of the email telling a report's author its outcome.
export function feedbackOutcomeEmail(language, report, name) {
  const lang = FEEDBACK_EMAIL_CONTENT[language] ? language : 'en'
  const c = FEEDBACK_EMAIL_CONTENT[lang]
  const s = c[report.status]
  const message = String(report.message || '')
  const { html, text } = renderEmail({
    language: lang,
    preheader: s.lead(c.kinds[report.kind] || c.kinds.misleading),
    hero: { overline: s.overline, title: s.title, lead: s.lead(c.kinds[report.kind] || c.kinds.misleading) },
    blocks: [
      { type: 'p', text: c.greeting(name) },
      { type: 'p', text: c.yours },
      { type: 'quote', text: message.length > 600 ? `${message.slice(0, 600)}…` : message },
      { type: 'p', text: c.more },
      { type: 'button', label: c.button, href: `${SITE_URL}/what-can-i-do` },
      { type: 'signoff', lines: c.signoff },
    ],
    footer: c.footer,
  })
  return { subject: s.subject, html, text }
}

// A report closed as done or rejected (the admins' Feedback page): its author
// is told by email - the outcome and their message - in the language they
// wrote it in. reporterEmailedAt records it (shown on the page). Only on a
// change of stage. A stage set with a team reply (the same batch names it:
// statusReplyId, new in this change) is told by that reply's email
// (onFeedbackReplied), with the outcome: one admin action, one email.
export const onFeedbackStatusChanged = onDocumentUpdated({ document: `${FEEDBACK_COLL_NAME}/{id}`, region: REGION, secrets: [RESEND_API_KEY] }, async (event) => {
  const before = event.data?.before.data()
  const report = event.data?.after.data()
  if (!before || !report || before.status === report.status || !TOLD.includes(report.status)) return
  if (report.statusReplyId && report.statusReplyId !== before.statusReplyId) return
  try {
    const author = await auth.getUser(report.userId).catch(() => null)
    if (!author?.email) return
    const language = report.language || (await db.collection(USERS_COLL_NAME).doc(report.userId).get()).get('language')
    const { subject, html, text } = feedbackOutcomeEmail(String(language || '').slice(0, 2), report, author.displayName?.split(' ')[0] || '')
    const result = await sendEmail({ to: author.email, subject, html, text })
    if (result.sent) await event.data.after.ref.update({ reporterEmailedAt: FieldValue.serverTimestamp() })
  } catch (error) {
    logger.error('[feedback] the reporter could not be emailed', { id: event.params.id, error: error.message })
  }
})
