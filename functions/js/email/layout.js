import { SITE_URL } from '../constants.js'

// OpenCaves' email layout: an email is a list of blocks, rendered both as HTML
// (tables and inline styles, what email clients understand) and as plain text
// (its alternative, for clients that don't show HTML) - one source, two forms.
// Colours: the app theme's light scheme (src/theme/Theme.jsx).
const C = {
  primary: '#145e79',
  primaryDark: '#0e4357',
  container: '#cfe6f1',
  surface: '#f3f1f0',
  page: '#eceae8',
  text: '#1c1b1f',
  muted: '#5b5960',
  border: '#e2dfdc',
  warning: '#8a5300',
  warningBg: '#fff4e0',
  warningBorder: '#f0c36d',
}
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const LOGO = `${SITE_URL}/pwa/icons/android-chrome-192x192.png`

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
// Escaped, line breaks kept, and **bold** marked.
const rich = (value) => escape(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')
const plain = (value) => String(value ?? '').replace(/\*\*(.+?)\*\*/g, '$1')

const H2 = `margin:0 0 6px;font-size:20px;line-height:28px;font-weight:600;color:${C.text};`
const P = `margin:0 0 16px;font-size:16px;line-height:25px;color:${C.text};`

function button({ label, href }) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px;"><tr><td style="border-radius:24px;background:${C.primary};">
<a href="${escape(href)}" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:16px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:24px;">${escape(label)}</a>
</td></tr></table>`
}

// A titled group of cards, each an icon (an emoji in a tinted circle), a
// title and a text.
function cards({ title, lead, items }) {
  const rows = items
    .map(
      ({ icon, title: itemTitle, text, link }) => `<tr><td style="padding:0 0 10px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border:1px solid ${C.border};border-radius:14px;"><tr>
<td width="44" valign="top" style="padding:16px 0 16px 16px;"><div style="width:44px;height:44px;line-height:44px;border-radius:22px;background:${C.container};text-align:center;font-size:22px;">${icon}</div></td>
<td valign="top" style="padding:16px 18px 16px 14px;font-family:${FONT};">
<div style="font-size:16px;line-height:22px;font-weight:600;color:${C.text};margin:0 0 4px;">${escape(itemTitle)}</div>
<div style="font-size:14px;line-height:21px;color:${C.muted};">${rich(text)}</div>
${link ? `<div style="margin-top:8px;font-size:14px;line-height:20px;"><a href="${escape(link.href)}" style="color:${C.primary};font-weight:600;text-decoration:none;">${escape(link.label)} &rarr;</a></div>` : ''}
</td></tr></table></td></tr>`,
    )
    .join('')
  return `<h2 style="${H2}">${escape(title)}</h2>${lead ? `<p style="margin:0 0 16px;font-size:15px;line-height:23px;color:${C.muted};">${rich(lead)}</p>` : ''}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;">${rows}</table>`
}

// Numbered steps, on a tinted panel.
function steps({ title, items }) {
  const rows = items
    .map(
      (text, i) => `<tr><td width="28" valign="top" style="padding:0 0 10px;"><div style="width:26px;height:26px;line-height:26px;border-radius:13px;background:${C.primary};color:#ffffff;text-align:center;font-size:13px;font-weight:700;">${i + 1}</div></td>
<td valign="top" style="padding:3px 0 10px 12px;font-size:15px;line-height:22px;color:${C.text};">${rich(text)}</td></tr>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:4px 0 24px;background:${C.surface};border-radius:14px;"><tr><td style="padding:20px 20px 12px;font-family:${FONT};">
<h2 style="${H2}margin-bottom:14px;">${escape(title)}</h2>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table></td></tr></table>`
}

function notes({ title, items }) {
  const rows = items
    .map(
      ({ icon, title: itemTitle, text }) => `<tr><td width="28" valign="top" style="padding:0 0 14px;font-size:20px;line-height:24px;">${icon}</td>
<td valign="top" style="padding:0 0 14px 10px;font-family:${FONT};"><div style="font-size:15px;line-height:22px;font-weight:600;color:${C.text};">${escape(itemTitle)}</div><div style="font-size:14px;line-height:21px;color:${C.muted};">${rich(text)}</div></td></tr>`,
    )
    .join('')
  return `<h2 style="${H2}margin-bottom:14px;">${escape(title)}</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px;">${rows}</table>`
}

function warning({ title, text }) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;background:${C.warningBg};border:1px solid ${C.warningBorder};border-radius:14px;"><tr>
<td width="28" valign="top" style="padding:16px 0 16px 16px;font-size:20px;line-height:24px;">&#9888;&#65039;</td>
<td valign="top" style="padding:16px 18px 16px 10px;font-family:${FONT};"><div style="font-size:15px;line-height:22px;font-weight:700;color:${C.warning};margin:0 0 2px;">${escape(title)}</div><div style="font-size:14px;line-height:21px;color:${C.text};">${rich(text)}</div></td></tr></table>`
}

// A highlighted message (the team's note to a tester), on the container tint.
function callout({ title, text }) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;background:${C.container};border-radius:14px;"><tr><td style="padding:16px 20px;font-family:${FONT};">
<div style="font-size:13px;line-height:18px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:${C.primary};margin:0 0 6px;">${escape(title)}</div>
<div style="font-size:16px;line-height:24px;color:${C.text};">${rich(text)}</div></td></tr></table>`
}

// A quoted text (a tester's message).
function quote({ text }) {
  return `<div style="margin:0 0 20px;padding:14px 18px;background:${C.surface};border-left:4px solid ${C.primary};border-radius:4px;font-size:15px;line-height:23px;color:${C.text};">${rich(text)}</div>`
}

// A message of a thread (a feedback report's): who wrote it and when, above
// its text - `html` already rendered (email/markdown.js), or the plain
// `text` (escaped, line breaks kept). `highlight`: the newest one, on the
// container tint; the earlier ones are quieter, with a side rule.
function message({ label, html, text, highlight }) {
  const content = html ?? rich(text)
  const box = highlight ? `background:${C.container};border-radius:14px;padding:16px 20px;` : `background:${C.surface};border-left:4px solid ${C.border};border-radius:4px;padding:12px 18px;`
  return `<div style="margin:0 0 ${highlight ? 24 : 14}px;${box}font-family:${FONT};">
<div style="font-size:13px;line-height:18px;font-weight:700;color:${highlight ? C.primary : C.muted};margin:0 0 6px;">${escape(label)}</div>
<div style="font-size:${highlight ? 16 : 15}px;line-height:${highlight ? 24 : 23}px;color:${C.text};">${content}</div></div>`
}

// Label: value rows.
function facts({ items }) {
  const rows = items
    .map(({ label, value, href }) => `<tr><td valign="top" style="padding:0 12px 8px 0;font-size:14px;line-height:21px;color:${C.muted};white-space:nowrap;">${escape(label)}</td><td valign="top" style="padding:0 0 8px;font-size:14px;line-height:21px;color:${C.text};">${href ? `<a href="${escape(href)}" style="color:${C.primary};">${escape(value)}</a>` : escape(value)}</td></tr>`)
    .join('')
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px;">${rows}</table>`
}

const HTML_BLOCKS = {
  // link (optional): { label, href }, after the text.
  p: ({ text, link }) => `<p style="${P}">${rich(text)}${link ? ` <a href="${escape(link.href)}" style="color:${C.primary};font-weight:600;">${escape(link.label)}</a>` : ''}</p>`,
  button,
  cards,
  steps,
  notes,
  warning,
  quote,
  callout,
  facts,
  message,
  h2: ({ text }) => `<h2 style="${H2}margin:8px 0 14px;">${escape(text)}</h2>`,
  signoff: ({ lines }) => `<p style="${P}margin-top:8px;">${lines.map(rich).join('<br>')}</p>`,
}

const TEXT_BLOCKS = {
  p: ({ text, link }) => `${plain(text)}${link ? ` ${link.label}: ${link.href}` : ''}`,
  button: ({ label, href }) => `${label}: ${href}`,
  cards: ({ title, lead, items }) => [title.toUpperCase(), lead && plain(lead), ...items.map(({ title: t, text, link }) => `- ${t}: ${plain(text)}${link ? ` (${link.href})` : ''}`)].filter(Boolean).join('\n'),
  steps: ({ title, items }) => [title.toUpperCase(), ...items.map((text, i) => `${i + 1}. ${plain(text)}`)].join('\n'),
  notes: ({ title, items }) => [title.toUpperCase(), ...items.map(({ title: t, text }) => `- ${t}: ${plain(text)}`)].join('\n'),
  warning: ({ title, text }) => `${title.toUpperCase()}\n${plain(text)}`,
  callout: ({ title, text }) => `${title.toUpperCase()}
${plain(text)}`,
  quote: ({ text }) => plain(text).split('\n').map((line) => `> ${line}`).join('\n'),
  facts: ({ items }) => items.map(({ label, value, href }) => `${label}: ${href || value}`).join('\n'),
  // The plain text (Markdown reads as text) under its label: the newest
  // message as is, the earlier ones quoted.
  message: ({ label, text, highlight }) => {
    const body = String(text ?? '').trim()
    return highlight ? `${label}\n\n${body}` : `${label}\n${body.split('\n').map((line) => `> ${line}`).join('\n')}`
  },
  h2: ({ text }) => `--- ${text} ---`,
  signoff: ({ lines }) => lines.map(plain).join('\n'),
}

/**
 * { html, text } for an email: `hero` (an optional overline, a title, an
 * optional lead) on the primary-coloured band, then the blocks, then
 * `footer` (a short line on why the reader got it), then, if given,
 * `unsubscribe` ({ text, label, href }): a small line linking to it.
 *
 * @param {object} email
 * @param {string} [email.language='en']
 * @param {string} [email.preheader='']
 * @param {{overline?: string, title: string, lead?: string}} email.hero
 * @param {object[]} email.blocks
 * @param {string} [email.footer='']
 * @param {{text: string, label: string, href: string}|null} [email.unsubscribe=null]
 * @returns {{html: string, text: string}}
 */
export function renderEmail({ language = 'en', preheader = '', hero, blocks, footer = '', unsubscribe = null }) {
  const body = blocks.map((block) => HTML_BLOCKS[block.type](block)).join('\n')
  const html = `<!doctype html>
<html lang="${escape(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escape(hero.title)}</title></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escape(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${C.page};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;font-family:${FONT};">
<tr><td style="padding:0 4px 16px;"><a href="${SITE_URL}" style="text-decoration:none;"><img src="${LOGO}" width="36" height="36" alt="" style="vertical-align:middle;border:0;"><span style="vertical-align:middle;margin-left:10px;font-size:20px;font-weight:600;color:${C.primary};">OpenCaves</span></a></td></tr>
<tr><td style="border-radius:20px 20px 0 0;background:${C.primary};background-image:linear-gradient(120deg,${C.primaryDark},${C.primary});padding:36px 32px;color:#ffffff;">
${hero.overline ? `<div style="font-size:12px;line-height:16px;letter-spacing:2px;text-transform:uppercase;font-weight:600;opacity:0.85;margin:0 0 10px;">${escape(hero.overline)}</div>` : ''}
<h1 style="margin:0;font-size:28px;line-height:36px;font-weight:600;color:#ffffff;">${escape(hero.title)}</h1>
${hero.lead ? `<p style="margin:12px 0 0;font-size:17px;line-height:26px;color:#ffffff;opacity:0.92;">${rich(hero.lead)}</p>` : ''}
</td></tr>
<tr><td style="background:#ffffff;border-radius:0 0 20px 20px;padding:32px 32px 16px;">
${body}
</td></tr>
<tr><td style="padding:20px 24px;text-align:center;font-size:12px;line-height:18px;color:${C.muted};">${rich(footer)}${footer ? '<br>' : ''}<a href="${SITE_URL}" style="color:${C.muted};">opencaves.org</a></td></tr>
${unsubscribe ? `<tr><td style="padding:0 24px 20px;text-align:center;font-size:11px;line-height:16px;color:${C.muted};">${escape(unsubscribe.text)} <a href="${escape(unsubscribe.href)}" style="color:${C.muted};">${escape(unsubscribe.label)}</a></td></tr>` : ''}
</table></td></tr></table></body></html>`
  const text = [hero.title, hero.lead && plain(hero.lead), ...blocks.map((block) => TEXT_BLOCKS[block.type](block)), footer && plain(footer), SITE_URL, unsubscribe && `${unsubscribe.text} ${unsubscribe.label}: ${unsubscribe.href}`].filter(Boolean).join('\n\n')
  return { html, text }
}

/**
 * A short email of plain paragraphs (the account notices): the first is the
 * greeting, the last the signature.
 *
 * @param {object} notice
 * @param {string} notice.language
 * @param {string} notice.title
 * @param {string[]} notice.paragraphs
 * @param {string} notice.footer
 * @returns {{html: string, text: string}}
 */
export function renderNotice({ language, title, paragraphs, footer }) {
  const body = paragraphs.slice(0, -1).map((text) => ({ type: 'p', text }))
  return renderEmail({ language, preheader: paragraphs[1] || '', hero: { title }, blocks: [...body, { type: 'signoff', lines: paragraphs.at(-1).split('\n') }], footer })
}
