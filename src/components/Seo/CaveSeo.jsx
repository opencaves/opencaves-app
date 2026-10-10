import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useCaveRatings } from '@/models/Rating.js'
import { SITE_URL } from '@/config/app.js'
import { markdownToPlainText, truncate } from '@/utils/seo.js'
import { setHeadMeta } from '@/utils/headTags.js'

/**
 * A cave page's own meta description (RouteSeo leaves it to this on cave
 * pages) and schema.org TouristAttraction data (name, coordinates, aggregate
 * rating).
 */
export default function CaveSeo({ cave }) {
  const { t } = useTranslation('seo')
  const { average, count } = useCaveRatings(cave.id)
  const name = cave.name?.value || ''
  const summary = markdownToPlainText(cave.description)
  const description = truncate(summary ? `${t('caveDescriptionPrefix', { name })} ${summary}` : t('caveDescriptionFallback', { name }))
  // The cave's own page: its one URL for search engines (canonicalPath).
  const url = `${SITE_URL}/caves/${cave.id}`

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name,
    description,
    url,
    address: { '@type': 'PostalAddress', addressCountry: 'MX' },
    ...(Array.isArray(cave.aka) && cave.aka.length > 0 && { alternateName: cave.aka }),
    ...(cave.location && { geo: { '@type': 'GeoCoordinates', latitude: cave.location.latitude, longitude: cave.location.longitude } }),
    ...(count > 0 && { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(average.toFixed(1)), ratingCount: count, bestRating: 5, worstRating: 1 } }),
  }

  useEffect(() => {
    setHeadMeta('description', description)
  }, [description])

  // Google reads JSON-LD anywhere in the document.
  return <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
}
