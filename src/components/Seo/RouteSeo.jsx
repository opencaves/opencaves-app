import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SITE_URL } from '@/config/app.js'
import { canonicalPath, isIndexable, isPublicIndexPath } from '@/utils/seo.js'
import { setHeadLink, setHeadMeta } from '@/utils/headTags.js'

/**
 * Per-route search-engine basics, for every page under AppRoot: a canonical
 * URL, noindex on private/admin pages, and no description on the pages that
 * have none of their own - one text shared by many pages is worse than none
 * (search engines then show the page's own text) - and the map's own on /map. Cave pages set theirs
 * (CaveSeo), the index pages theirs (/caves, /sistemas, an area, a system:
 * useIndexPageHead). (Effects run children-first, so this must not touch it
 * there.)
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
    // The map has its own (also in its page, map.html: vite.config.js); the
    // others none - the last page's must not stay either.
    if (!setsOwnDescription) setHeadMeta('description', pathname === '/map' ? t('mapDescription') : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, canonical, setsOwnDescription, i18n.resolvedLanguage])

  return null
}
