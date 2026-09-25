import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { uriTransformer } from './uri-transformer'

export default function Markdown(props) {
  return (
    <div className="oc-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={uriTransformer}>{props.children}</ReactMarkdown>
    </div>
  )
}