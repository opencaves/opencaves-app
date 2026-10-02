import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
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

export default function Markdown(props) {
  return (
    <div className="oc-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkLengthDirective]} urlTransform={uriTransformer} components={components}>
        {props.children}
      </ReactMarkdown>
    </div>
  )
}
