import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SITE_URL } from '@/config/app.js'
import { canonicalPath, isIndexable, isPublicIndexPath } from '@/utils/seo.js'
import { setHeadLink, setHeadMeta } from '@/utils/headTags.js'

/**
 * Per-route search-engine basics, for every page under AppRoot: a canonical
 * URL, noindex on private/admin pages, and the localized default description
 * - except on cave pages, whose description CaveSeo sets, and the index pages
 * (/caves, /sistemas, an area, a system), which set their own
 * (useIndexPageHead). (Effects run children-first, so this must not
 * overwrite it there.)
 */
export default function RouteSeo() {
  const { t, i18n } = useTranslation('seo')
  const { pathname } = useLocation()
  const canonical = canonicalPath(pathname)
  // A cave on the map (CaveSeo sets its description).
  const isCavePage = /^\/map\/[^/]+\/?$/.test(pathname)
  const setsOwnDescription = isCavePage || isPublicIndexPath(canonical)

  useEffect(() => {
    setHeadLink('canonical', `${SITE_URL}${canonical}`)
    setHeadMeta('robots', isIndexable(pathname) ? null : 'noindex')
    if (!setsOwnDescription) {
      setHeadMeta('description', t('defaultDescription'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, canonical, setsOwnDescription, i18n.resolvedLanguage])

  return null
}
