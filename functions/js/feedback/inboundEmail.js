import { createHmac, timingSafeEqual } from 'node:crypto'

// Small pure helpers for feedbackInbound (an author's email answer to a
// report's thread, received by Resend): the webhook's signature, the reply
// address' token, automatic mail, the sender's check and the new text of the
// answer. No library: imported by feedbackInbound only when a webhook comes in.

// A webhook signed by Resend (Svix): secret `whsec_<base64 key>`; signed
// content `<svix-id>.<svix-timestamp>.<raw body>`, HMAC-SHA256 in base64; the
// svix-signature header lists space-separated `v1,<signature>` entries (one
// per key while a secret is rotated) - one match is enough. A timestamp more
// than `toleranceSeconds` off is refused (a replayed delivery).
export function verifyWebhookSignature({ secret, id, timestamp, signature, body, now = Date.now(), toleranceSeconds = 5 * 60 }) {
  if (!secret || !id || !timestamp || !signature || body == null) return { ok: false, reason: 'missing' }
  const seconds = Number(timestamp)
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > toleranceSeconds) return { ok: false, reason: 'timestamp' }
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64')
  if (!key.length) return { ok: false, reason: 'secret' }
  const payload = Buffer.concat([Buffer.from(`${id}.${timestamp}.`), Buffer.isBuffer(body) ? body : Buffer.from(String(body))])
  const expected = createHmac('sha256', key).update(payload).digest()
  const ok = String(signature)
    .split(' ')
    .some((entry) => {
      const [version, value] = entry.split(',')
      if (version !== 'v1' || !value) return false
      const given = Buffer.from(value, 'base64')
      return given.length === expected.length && timingSafeEqual(given, expected)
    })
  return ok ? { ok: true } : { ok: false, reason: 'signature' }
}

// A report's reply token: 24 lowercase letters and digits (onFeedbackReplied),
// the local part of its reply address (<token>@<FEEDBACK_REPLY_DOMAIN>).
export const REPLY_TOKEN_PATTERN = /^[a-z0-9]{24}$/

// The bare address of "Name <a@b.c>" or "a@b.c", lowercased.
export function emailAddress(value) {
  const text = String(value ?? '').trim()
  const match = text.match(/<([^<>\s]+@[^<>\s]+)>/) || text.match(/([^\s<>"]+@[^\s<>"]+)/)
  return match ? match[1].toLowerCase() : ''
}

const domainOf = (address) => address.split('@').pop()

// The report's token among the email's recipients (to, cc, received_for) at
// the reply domain, or null.
export function findReplyToken(email, domain) {
  const recipients = [email.to, email.cc, email.received_for].flat().filter(Boolean).map(emailAddress)
  for (const address of recipients) {
    const [local, host] = address.split('@')
    // A "+tag" some mail apps add stays out of the token.
    const token = local?.split('+')[0]
    if (host === domain.toLowerCase() && REPLY_TOKEN_PATTERN.test(token)) return token
  }
  return null
}

// The email's headers with lowercase names, each value a string.
export function normalizeHeaders(headers) {
  const result = {}
  if (Array.isArray(headers)) {
    for (const { name, value } of headers) if (name) result[String(name).toLowerCase()] = [result[String(name).toLowerCase()], value].filter(Boolean).join(', ')
  } else {
    for (const [name, value] of Object.entries(headers || {})) result[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value ?? '')
  }
  return result
}

const AUTOMATIC_SENDERS = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounces?)([+.-]|$)/i

// Why an email is automatic (an out-of-office, a bounce, a list), or null.
// Never answered or added to a thread: no mail loops.
export function automaticReason(email) {
  const headers = normalizeHeaders(email.headers)
  const autoSubmitted = headers['auto-submitted']?.trim().toLowerCase()
  if (autoSubmitted && autoSubmitted !== 'no') return `auto-submitted: ${autoSubmitted}`
  if ('x-autoreply' in headers) return 'x-autoreply'
  if ('x-autorespond' in headers) return 'x-autorespond'
  if (/^(bulk|junk|auto_reply|list)$/i.test(headers.precedence?.trim() || '')) return `precedence: ${headers.precedence.trim()}`
  if ('list-id' in headers || 'list-unsubscribe' in headers) return 'list'
  if (headers['return-path']?.trim() === '<>') return 'null return-path'
  const from = emailAddress(email.from || headers.from)
  if (!from) return 'no sender'
  if (AUTOMATIC_SENDERS.test(from.split('@')[0])) return `sender: ${from}`
  return null
}

// Whether the email really comes from the report's author: its From address
// is theirs, and the receiving server's checks (Resend's `authentication`:
// 'pass' | 'fail' | 'gray' | ...) vouch for it - DKIM passes (Resend says
// 'gray' when the signing domain isn't the From's), or DMARC passes, or SPF
// passes for an envelope sender (Return-Path) of the From's domain. A DMARC
// failure refuses it whatever the rest.
export function checkSender(email, authorEmail) {
  const from = emailAddress(email.from || normalizeHeaders(email.headers).from)
  if (!from || !authorEmail || from !== String(authorEmail).trim().toLowerCase()) return { ok: false, reason: 'not the author' }
  const results = email.authentication || {}
  const dmarc = String(results.dmarc || '').toLowerCase()
  if (dmarc === 'fail') return { ok: false, reason: 'dmarc fail' }
  if (String(results.dkim || '').toLowerCase() === 'pass') return { ok: true, by: 'dkim' }
  if (dmarc === 'pass') return { ok: true, by: 'dmarc' }
  const returnPath = emailAddress(normalizeHeaders(email.headers)['return-path'])
  if (String(results.spf || '').toLowerCase() === 'pass' && returnPath && domainOf(returnPath) === domainOf(from)) return { ok: true, by: 'spf' }
  return { ok: false, reason: 'not authenticated' }
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

// An HTML email's text, its quoted part dropped (Gmail's gmail_quote, Apple
// Mail's and Thunderbird's blockquote, Outlook's divRplyFwdMsg/appendonsend).
export function htmlToText(html) {
  let body = String(html ?? '')
  const cut = body.search(/<(div|blockquote)[^>]*(class="[^"]*gmail_quote|type="cite"|id="(divRplyFwdMsg|appendonsend)")|<div[^>]*id="?mail-editor-reference-message-container|<hr[^>]*id="?stopSpelling/i)
  if (cut >= 0) body = body.slice(0, cut)
  return body
    .replace(/<(head|style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
        return Number.isFinite(n) ? String.fromCodePoint(n) : entity
      }
      return ENTITIES[code.toLowerCase()] ?? entity
    })
}

// A line that starts the quoted thread: "On <date>, <name> wrote:" (en),
// "Le <date>, <name> a écrit :" (fr), "El <date>, <name> escribió:" (es),
// and the separators of Outlook and others.
const QUOTE_HEADER = [/^on\b.+\bwrote:\s*$/i, /^le\b.+\ba écrit\s*:\s*$/i, /^el\b.+\bescribi[óo]\s*:\s*$/i, /^-{2,}\s*(original message|message d'origine|mensaje original|forwarded message|message transféré|mensaje reenviado)\s*-{2,}\s*$/i, /^_{10,}\s*$/]
// Outlook's quote header: a From line, then Sent/Date a line or two below.
const OUTLOOK_FROM = /^\*?(from|de)\s*:\*?\s+\S/i
const OUTLOOK_SENT = /^\*?(sent|date|envoyé|enviado|fecha)\s*:/i
// The phone's signature mail apps add.
const DEVICE_SIGNATURE = /^(sent from my|envoyé de mon|enviado desde mi)\b/i

// The new text of an email answer: the quoted thread and the signature
// removed. Lines quoted with '>' go; the first quote header (or a "-- "
// signature, or "Sent from my iPhone") ends the answer.
export function extractReply(text) {
  const lines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
  const kept = []
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trimEnd()
    const trimmed = line.trim()
    // A quote header wrapped over two lines (Gmail wraps long ones).
    const joined = `${trimmed} ${(lines[i + 1] || '').trim()}`
    if (QUOTE_HEADER.some((pattern) => pattern.test(trimmed) || (/^(on|le|el)\b/i.test(trimmed) && pattern.test(joined)))) break
    if (OUTLOOK_FROM.test(trimmed) && lines.slice(i + 1, i + 4).some((next) => OUTLOOK_SENT.test(next.trim()))) break
    if (line === '-- ' || line === '--' || DEVICE_SIGNATURE.test(trimmed)) break
    if (trimmed.startsWith('>')) continue
    kept.push(line)
  }
  return kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// The answer's text to keep: the plain version, else the HTML's, stripped,
// cut to `maxLength`.
export function replyText(email, maxLength) {
  const source = email.text && String(email.text).trim() ? email.text : htmlToText(email.html)
  const text = extractReply(source)
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}
