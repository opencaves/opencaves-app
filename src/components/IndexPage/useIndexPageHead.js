import { useEffect } from 'react'
import { useTitle } from '@/hooks/useTitle.jsx'
import { setHeadMeta } from '@/utils/headTags.js'

/**
 * An index page's <title> ("<title> / Open Caves", or `title` as it is with
 * `fullTitle`) and meta description - the same tags the server renders for
 * it (functions/js/seo). RouteSeo leaves the description of these pages to
 * them, and sets the canonical URL.
 *
 * @param {object} head
 * @param {string|null} [head.title]
 * @param {string|null} [head.description]
 * @param {boolean} [head.fullTitle=false] - The title already names the app (the landing page's): no " / Open Caves".
 */
export function useIndexPageHead({ title, description, fullTitle = false }) {
  const { setTitle } = useTitle()

  useEffect(() => {
    if (title) setTitle(title, { full: fullTitle })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, fullTitle])

  useEffect(() => {
    if (description) setHeadMeta('description', description)
  }, [description])
}
