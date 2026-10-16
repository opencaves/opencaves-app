import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box } from '@mui/material'
import { uriTransformer } from './uri-transformer'
import remarkLengthDirective from './lengthDirective.js'
import Length from './Length.jsx'

// In-app links (oc:<caveId> becomes /map/<caveId> in uriTransformer, both
// for links written in the editor and for auto-linked cave names) go
// through the router, so following one doesn't reload the whole app.
// External links (http, mailto, tel) stay plain anchors.
function MarkdownLink({ href, node, ...props }) {
  if (href?.startsWith('/') && !href.startsWith('//')) {
    return <Link to={href} {...props} />
  }
  return <a href={href} {...props} />
}

// The `:length[45 m]` tags (lengthDirective.js), in the reader's units.
function MarkdownSpan({ node, ...props }) {
  if (props['data-length'] != null) return <Length text={props['data-length']} />
  return <span {...props} />
}

const components = { a: MarkdownLink, span: MarkdownSpan }

// Footnotes (GFM's [^1]): their section, gathered at the end, under a small
// quiet label over a thin line - not the big heading GFM leaves to an
// sr-only class this app doesn't have - in a smaller size.
const FOOTNOTES_SX = (theme) => ({
  '& .footnotes': { mt: 2, pt: 1, borderTop: `1px solid ${theme.vars.sys.color.outlineVariant}`, fontSize: '0.875rem' },
  '& .footnotes ol': { my: 0.5, pl: 2.5 },
  '& .footnotes p': { my: 0.25 },
  '& .oc-markdown--footnotes-label': { m: 0, fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.04em', lineHeight: 1.6, color: 'text.secondary' },
})

/**
 * Markdown as the app shows it (GFM, the :length tags in the reader's units,
 * in-app links through the router): a cave's or a system's description,
 * directions... Its footnotes under a translated label ({@link FOOTNOTES_SX}).
 *
 * @param {object} props
 * @param {string} [props.children] - The Markdown.
 */
export default function Markdown({ children }) {
  const { t } = useTranslation('app', { keyPrefix: 'markdown' })
  const remarkRehypeOptions = {
    footnoteLabel: t('footnotes'),
    footnoteLabelProperties: { className: ['oc-markdown--footnotes-label'] },
    footnoteBackLabel: (referenceIndex) => t('footnoteBack', { ref: referenceIndex + 1 }),
  }
  return (
    <Box className="oc-markdown" sx={FOOTNOTES_SX}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkLengthDirective]} remarkRehypeOptions={remarkRehypeOptions} urlTransform={uriTransformer} components={components}>
        {children}
      </ReactMarkdown>
    </Box>
  )
}
