import { Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import { slugify } from '@/utils/slug.js'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map.js'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import IndexSection from '@/components/IndexPage/IndexSection.jsx'
import IndexLinkList from '@/components/IndexPage/IndexLinkList.jsx'
import IndexPageSkeleton from '@/components/IndexPage/IndexPageSkeleton.jsx'
import { useIndexPageHead } from '@/components/IndexPage/useIndexPageHead.js'
import { throwNotFound } from '@/components/IndexPage/notFound.js'

// /areas/<slug>: an area's cenotes and cave systems (its own systems and
// those of its cenotes). Editors edit its record at /areas/<slug>/edit.
export default function AreaPage() {
  const { areaSlug } = useParams()
  const { t } = useTranslation('indexPages')
  const { data, loading } = useIndexData()
  const area = data.areasBySlug.get(areaSlug)

  useIndexPageHead(area ? { title: t('area.title', { area: area.name }), description: t('area.description', { area: area.name }) } : {})

  if (loading) return <IndexPageSkeleton />
  if (!area) {
    // An area's name or record id (an older or hand-typed address): its slug.
    const slug = slugify(areaSlug)
    if (slug && data.areasBySlug.has(slug)) return <Navigate to={`/areas/${slug}`} replace />
    throwNotFound()
  }

  return (
    <div className="oc-area-page">
      <IndexPageHeader title={t('area.title', { area: area.name })} subtitle={[t('caveCount', { count: area.caves.length }), t('sistemaCount', { count: area.sistemas.length })].join(' · ')} backTo="/caves" editTo={area.recordId ? `/areas/${area.slug}/edit` : null} editLabel={t('area.edit', { area: area.name })} />

      <IndexSection title={t('area.cenotes')} count={area.caves.length}>
        {area.caves.length > 0 ? <IndexLinkList items={area.caves.map((cave) => ({ key: cave.id, to: `/caves/${cave.id}`, mapTo: `/map/${cave.id}`, label: cave.name || t('unnamedCave') }))} /> : <Typography sx={{ color: 'text.secondary' }}>{t('area.noCenotes')}</Typography>}
      </IndexSection>

      <IndexSection title={t('area.sistemas')} count={area.sistemas.length}>
        {area.sistemas.length > 0 ? <IndexLinkList items={area.sistemas.map((sistema) => ({ key: sistema.id, to: `/sistemas/${sistema.slug}`, label: sistema.name, color: sistema.color || SISTEMA_DEFAULT_COLOR }))} /> : <Typography sx={{ color: 'text.secondary' }}>{t('area.noSistemas')}</Typography>}
      </IndexSection>
    </div>
  )
}
