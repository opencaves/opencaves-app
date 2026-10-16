import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { db } from '../init.js'
import { AI_DRAFTS_COLL_NAME, CAVES_COLL_NAME, ENFORCE_APP_CHECK, REGION } from '../constants.js'

// An AI draft of a new Further reading document's summary, for an editor to
// review in the form (never saved by itself): Gemini on Vertex AI, from the
// paper's abstract (Crossref, else OpenAlex, by its DOI) or else the text
// the form read from its PDF - nothing to draft from, no draft. In the
// paper's own language. Editors only, DAILY_LIMIT a day each.

// The model, and how much it may think first: most of a draft's cost and
// time was its thinking (a test of six papers, 2026-10-16).
const MODEL = 'gemini-2.5-flash'
const THINKING_BUDGET = 512
const DAILY_LIMIT = 20
// The project whose Vertex AI is called (the functions' own; the emulator sets it too).
const PROJECT = process.env.GCLOUD_PROJECT || 'opencaves'
// The PDF text the form sends, at most (its first pages).
const MAX_PDF_TEXT = 20000
const MAX_FIELD = 500
const SOURCE_TIMEOUT_MS = 8000
const MODEL_TIMEOUT_MS = 45000
// The content languages' codes (the `languages` collection) as words for the
// model; any other, English.
const LANGUAGE_NAMES = { eng: 'English', spa: 'Spanish', fra: 'French', deu: 'German', ita: 'Italian', por: 'Portuguese', nld: 'Dutch', pol: 'Polish', ces: 'Czech', rus: 'Russian', jpn: 'Japanese', zho: 'Chinese' }

const INSTRUCTIONS = (language) => `You write summaries of scientific papers and reports for OpenCaves, a website for cave divers about underwater caves.
Write an ORIGINAL summary in ${language} of the paper below - in your own words, not a copy of its abstract: no sentence or long phrase copied from it.
One paragraph of 120-200 words, 5-8 sentences, for a cave diver: what was studied and where in the cave (section, depth, distance from the entrance if given), what was found with its key dates and numbers, and why it matters. Plain text, no Markdown, no title.
Use ONLY the facts in the text below and the cave named with it. Never add a fact, number, date or place it doesn't give. If the text is thin (no results), write a shorter summary of what it does say, without padding. Never mention the text itself, the abstract or what is missing from it.`

const clip = (value, max = MAX_FIELD) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const plain = (text) => text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

// A paper's abstract by its DOI: Crossref's (JATS), else OpenAlex's (an
// index of its words); '' when neither has one.
async function abstractOf(doi) {
  const encoded = encodeURIComponent(doi).replace(/%2F/gi, '/')
  try {
    const response = await fetch(`https://api.crossref.org/works/${encoded}`, { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) })
    const abstract = response.ok ? plain((await response.json()).message?.abstract || '').replace(/^abstract\s*/i, '') : ''
    if (abstract.split(' ').length >= 30) return abstract
  } catch (error) {
    logger.info('[draftSummary] Crossref unavailable', { doi, error: error?.message })
  }
  try {
    const response = await fetch(`https://api.openalex.org/works/doi:${encoded}?select=abstract_inverted_index`, { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) })
    const index = response.ok ? (await response.json()).abstract_inverted_index : null
    if (!index) return ''
    const words = []
    for (const [word, places] of Object.entries(index)) for (const place of places) words[place] = word
    return words.join(' ')
  } catch (error) {
    logger.info('[draftSummary] OpenAlex unavailable', { doi, error: error?.message })
    return ''
  }
}

// The cave or system the document is added to, and the cave's system: their
// names, so the draft can say where (an abstract seldom names the cave).
async function placeOf(holder) {
  if (!holder || ![CAVES_COLL_NAME, 'sistemas'].includes(holder.collection) || typeof holder.id !== 'string' || !holder.id) return ''
  const record = (await db.collection(holder.collection).doc(holder.id).get()).data()
  if (!record) return ''
  const name = (value) => (typeof value === 'string' ? value : value?.value) || ''
  if (holder.collection === 'sistemas') return `the ${name(record.name)} cave system`
  const system = record.sistemaId ? (await db.collection('sistemas').doc(record.sistemaId).get()).data() : null
  return [`the cave ${name(record.name)}`, system && `in the ${name(system.name)} system`].filter(Boolean).join(' ')
}

// One more draft today for this account, or false past the limit.
async function countDraft(uid) {
  const today = new Date().toISOString().slice(0, 10)
  const ref = db.collection(AI_DRAFTS_COLL_NAME).doc(uid)
  return db.runTransaction(async (transaction) => {
    const current = (await transaction.get(ref)).data()
    const count = current?.day === today ? current.count : 0
    if (count >= DAILY_LIMIT) return false
    transaction.set(ref, { day: today, count: count + 1 })
    return true
  })
}

// Vertex AI's answer to the prompt, with the functions' own account.
async function generate(prompt) {
  const { GoogleAuth } = await import('google-auth-library')
  const token = await new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' }).getAccessToken()
  const response = await fetch(`https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: THINKING_BUDGET } } }),
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body?.error?.message || `Vertex AI ${response.status}`)
  const text = (body.candidates?.[0]?.content?.parts || []).filter((part) => !part.thought).map((part) => part.text || '').join('').trim()
  return { text, usage: body.usageMetadata || {} }
}

/**
 * A summary drafted by AI for a new Further reading document (the Add a
 * document form's Draft with AI), from its abstract (by `doi`) or else
 * `pdfText`, in the paper's language (`language`, a content language's
 * code). Editors only, {@link DAILY_LIMIT} drafts a day each.
 *
 * @throws {HttpsError} `permission-denied` (not an editor), `failed-precondition` (nothing to draft from),
 *   `resource-exhausted` (today's drafts used), `unavailable` (the model failed).
 */
export const draftDocumentSummary = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK, memory: '256MiB', timeoutSeconds: 60, maxInstances: 5 }, async (request) => {
  if (!request.auth?.token?.roles?.includes('editor')) throw new HttpsError('permission-denied', 'Editors only.')
  const data = request.data || {}
  const doi = clip(data.doi, 300)
  const abstract = /^10\.\d{4,9}\/\S+$/.test(doi) ? await abstractOf(doi) : ''
  const pdfText = clip(data.pdfText, MAX_PDF_TEXT)
  const source = abstract ? 'abstract' : pdfText.split(/\s+/).length >= 60 ? 'pdf' : null
  if (!source) throw new HttpsError('failed-precondition', 'Nothing to draft from: no abstract, no PDF text.')
  if (!(await countDraft(request.auth.uid))) throw new HttpsError('resource-exhausted', `${DAILY_LIMIT} drafts a day.`)

  const place = await placeOf(data.holder)
  const authors = Array.isArray(data.authors) ? data.authors.slice(0, 20).map((author) => clip(author, 200)).filter(Boolean).join(', ') : ''
  const prompt = [
    INSTRUCTIONS(LANGUAGE_NAMES[data.language] || 'English'),
    '',
    `Title: ${clip(data.title)}`,
    authors && `Authors: ${authors}`,
    clip(data.year, 4) && `Year: ${clip(data.year, 4)}`,
    clip(data.publishedIn) && `Published in: ${clip(data.publishedIn)}`,
    place && `About: ${place}`,
    source === 'abstract' ? `Abstract: ${abstract}` : `The paper's first pages: ${pdfText}`,
  ].filter((line) => line !== false && line !== '' && line != null).join('\n')
  try {
    const { text, usage } = await generate(prompt)
    if (!text) throw new Error('empty answer')
    logger.info('[draftSummary] drafted', { uid: request.auth.uid, source, model: MODEL, inputTokens: usage.promptTokenCount, outputTokens: usage.candidatesTokenCount, thinkingTokens: usage.thoughtsTokenCount || 0 })
    return { summary: text, source }
  } catch (error) {
    logger.warn('[draftSummary] the model failed', { uid: request.auth.uid, error: error?.message })
    throw new HttpsError('unavailable', 'The draft could not be made.')
  }
})
