import MarkdownIt from 'markdown-it'
import { SITE_URL } from '../constants.js'

// The team's Markdown (feedback replies, written with the app's Markdown
// editor) as email HTML. Loaded only by the functions that need it (a
// dynamic import), never at startup. Raw HTML in the text is not allowed
// (shown as text), and links keep the app's rules (Markdown.jsx'
// uriTransformer): http(s), mailto and tel; a cave link (oc:<caveId>) leads
// to the cave's page, an in-app path to the site.

// Email clients drop <style>: each element gets its own inline style.
const STYLES = {
  paragraph_open: 'margin:0 0 12px;',
  heading_open: 'margin:16px 0 8px;font-size:18px;line-height:24px;font-weight:600;',
  bullet_list_open: 'margin:0 0 12px;padding-left:24px;',
  ordered_list_open: 'margin:0 0 12px;padding-left:24px;',
  list_item_open: 'margin:0 0 4px;',
  blockquote_open: 'margin:0 0 12px;padding:4px 0 4px 14px;border-left:3px solid #e2dfdc;color:#5b5960;',
  link_open: 'color:#145e79;',
  code_inline: 'font-family:Consolas,Menlo,monospace;font-size:0.92em;background:#f3f1f0;padding:1px 4px;border-radius:4px;',
  code_block: 'margin:0 0 12px;padding:10px 12px;background:#f3f1f0;border-radius:8px;font-family:Consolas,Menlo,monospace;font-size:13px;white-space:pre-wrap;',
  fence: 'margin:0 0 12px;padding:10px 12px;background:#f3f1f0;border-radius:8px;font-family:Consolas,Menlo,monospace;font-size:13px;white-space:pre-wrap;',
  hr: 'border:0;border-top:1px solid #e2dfdc;margin:16px 0;',
  image: 'max-width:100%;height:auto;',
  table_open: 'border-collapse:collapse;margin:0 0 12px;',
  th_open: 'border:1px solid #e2dfdc;padding:4px 8px;text-align:left;',
  td_open: 'border:1px solid #e2dfdc;padding:4px 8px;',
}
const PROTOCOLS = /^(https?|mailto|tel):/i

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

md.validateLink = (url) => {
  const link = url.trim()
  return link.startsWith('/') || link.startsWith('#') || link.startsWith('oc:') || PROTOCOLS.test(link) || !/^[a-z][a-z0-9+.-]*:/i.test(link)
}
const normalizeLink = md.normalizeLink.bind(md)
md.normalizeLink = (url) => {
  const link = url.trim()
  if (link.startsWith('oc:')) return `${SITE_URL}/caves/${encodeURIComponent(link.slice(3))}`
  if (link.startsWith('/') && !link.startsWith('//')) return normalizeLink(`${SITE_URL}${link}`)
  return normalizeLink(link)
}

md.core.ruler.push('oc_email_styles', (state) => {
  const style = (tokens) => {
    for (const token of tokens) {
      if (STYLES[token.type]) token.attrJoin('style', STYLES[token.type])
      if (token.type === 'link_open') token.attrSet('target', '_blank')
      if (token.children) style(token.children)
    }
  }
  style(state.tokens)
})

// The `:length[45 m]` tags (the app shows them in the reader's units): their
// value as written.
const untag = (text) => String(text ?? '').replace(/:length\[([^\]]*)\](\{[^}]*\})?/g, '$1')

/**
 * { html, text } of a Markdown text: the HTML for the email's formatted
 * version, the text (the Markdown itself, which reads as text) for its plain
 * one.
 *
 * @param {string} markdown
 * @returns {{html: string, text: string}}
 */
export function renderMarkdown(markdown) {
  const source = untag(markdown)
  const text = source.replace(/\]\(oc:([^)\s]+)\)/g, (_, id) => `](${SITE_URL}/caves/${encodeURIComponent(id)})`)
  return { html: md.render(source).trim(), text: text.trim() }
}
