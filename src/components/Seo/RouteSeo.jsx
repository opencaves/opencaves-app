import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SITE_URL } from '@/config/app.js'
import { canonicalPath, isIndexable, isPublicIndexPath } from '@/utils/seo.js'
import { setHeadLink, setHeadMeta, setShareImage } from '@/utils/headTags.js'
import { defaultShareImage } from '@/utils/shareImage.js'

// The pages with a description of their own here (`seo` namespace), also in
// their static page (map.html, about.html...: vite.config.js's
// writeStaticPages) - kept in step.
const OWN_DESCRIPTIONS = { '/map': 'mapDescription', '/about': 'aboutDescription', '/privacy': 'privacyDescription', '/terms': 'termsDescription' }

/**
 * Per-route search-engine basics, for every page under AppRoot: a canonical
 * URL, noindex on private/admin pages, and no description on the pages that
 * have none of their own - one text shared by many pages is worse than none
 * (search engines then show the page's own text) - and their own on /map,
 * /about, /privacy and /terms ({@link OWN_DESCRIPTIONS}). Cave pages set theirs
 * (CaveSeo), the index pages theirs (/caves, /sistemas, an area, a system:
 * useIndexPageHead) - and their share image (og:image); the others get the
 * site's. (Effects run children-first, so this must not touch it
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
    // Those pages their own; the others none - the last page's must not stay
    // either.
    if (!setsOwnDescription) setHeadMeta('description', OWN_DESCRIPTIONS[pathname] ? t(OWN_DESCRIPTIONS[pathname]) : null)
    // Likewise the share image: the last cave's must not stay.
    if (!setsOwnDescription) setShareImage(defaultShareImage(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, canonical, setsOwnDescription, i18n.resolvedLanguage])

  return null
}
