import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useTitle } from '@/hooks/useTitle.jsx'
import { setHeadMeta, setShareImage } from '@/utils/headTags.js'
import { shareImageOf } from '@/utils/shareImage.js'

/**
 * An index page's <title> ("<title> / Open Caves", or `title` as it is with
 * `fullTitle`), meta description and share image (og:image) - the same tags
 * the server renders for it (functions/js/seo). RouteSeo leaves the
 * description and the share image of these pages to them, and sets the
 * canonical URL.
 *
 * @param {object} head
 * @param {string|null} [head.title]
 * @param {string|null} [head.description]
 * @param {boolean} [head.fullTitle=false] - The title already names the app (the landing page's): no " / Open Caves".
 * @param {{record: {shareImage?: object}, name: string}|null} [head.share] - A cave's or a system's page: the record
 *   whose share image it shows and what that shows (its name; utils/shareImage.js). None: the site's image.
 */
export function useIndexPageHead({ title, description, fullTitle = false, share = null }) {
  const { setTitle } = useTitle()
  const { t, i18n } = useTranslation('seo')

  useEffect(() => {
    if (title) setTitle(title, { full: fullTitle })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, fullTitle])

  useEffect(() => {
    if (description) setHeadMeta('description', description)
  }, [description])

  const image = shareImageOf(share?.record, share?.name, t)
  useEffect(() => {
    setShareImage(image)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image.url, image.alt, i18n.resolvedLanguage])
}
