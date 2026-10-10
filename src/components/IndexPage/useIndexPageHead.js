import { useEffect } from 'react'
import { useTitle } from '@/hooks/useTitle.jsx'
import { setHeadMeta } from '@/utils/headTags.js'

/**
 * An index page's <title> ("<title> / OpenCaves") and meta description -
 * the same tags the server renders for it (functions/js/seo). RouteSeo
 * leaves the description of these pages to them, and sets the canonical URL.
 */
export function useIndexPageHead({ title, description }) {
  const { setTitle } = useTitle()

  useEffect(() => {
    if (title) setTitle(title)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  useEffect(() => {
    if (description) setHeadMeta('description', description)
  }, [description])
}
