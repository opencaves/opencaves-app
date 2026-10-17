import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useCaveRatings } from '@/models/Rating.js'
import { SITE_URL } from '@/config/app.js'
import { markdownToPlainText, truncate } from '@/utils/seo.js'
import { setHeadMeta, setShareImage } from '@/utils/headTags.js'
import { shareImageOf } from '@/utils/shareImage.js'
import { caveJsonLd } from '@/utils/structuredData.js'

/**
 * A cave page's own meta description and share image (RouteSeo leaves them
 * to this on cave pages) and schema.org data ({@link caveJsonLd}: the same
 * as the server's page, functions/js/seo/cavePage.js, in the app's language). Rendered
 * on the map only (/map/<caveId>, which the server doesn't render with the
 * app): the server-rendered /caves/<caveId> keeps the server's, in <head>.
 *
 * @param {object} props
 * @param {Cave} props.cave
 */
export default function CaveSeo({ cave }) {
  const { t } = useTranslation('seo')
  const { t: tIndex } = useTranslation('indexPages')
  const { average, count } = useCaveRatings(cave.id)
  const name = cave.name?.value || ''
  const summary = markdownToPlainText(cave.description)
  const description = truncate(summary ? `${t('caveDescriptionPrefix', { name })} ${summary}` : t('caveDescriptionFallback', { name }))
  // Its cover photo or its map card (the server's shareImage), else the site's.
  const image = shareImageOf(cave, name || tIndex('unnamedCave'), t)
  // Its own system, as the server names it (none when it has no record).
  const sistema = cave.sistemaId ? cave.sistemas?.find(({ id }) => id === cave.sistemaId) : null

  const structuredData = caveJsonLd({
    siteUrl: SITE_URL,
    id: cave.id,
    name: name || tIndex('unnamedCave'),
    description,
    aka: Array.isArray(cave.aka) ? cave.aka.filter(Boolean) : [],
    location: cave.location?.latitude != null ? cave.location : null,
    image: cave.shareImage?.url ? image.url : null,
    area: cave.area || null,
    sistema: sistema && sistema.name !== 'n. d.' ? { id: sistema.id, name: sistema.name } : null,
    rating: { average, count },
  })

  useEffect(() => {
    setHeadMeta('description', description)
  }, [description])

  useEffect(() => {
    setShareImage(image)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image.url, image.alt])

  // Google reads JSON-LD anywhere in the document.
  return <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
}
