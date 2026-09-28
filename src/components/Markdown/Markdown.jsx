import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import { uriTransformer } from './uri-transformer'

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

const components = { a: MarkdownLink }

export default function Markdown(props) {
  return (
    <div className="oc-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={uriTransformer} components={components}>
        {props.children}
      </ReactMarkdown>
    </div>
  )
}
