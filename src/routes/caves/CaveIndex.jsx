import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Link, Typography } from '@mui/material'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import { groupByArea } from '@/utils/indexData.js'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import IndexSection from '@/components/IndexPage/IndexSection.jsx'
import IndexLinkList from '@/components/IndexPage/IndexLinkList.jsx'
import IndexPageSkeleton from '@/components/IndexPage/IndexPageSkeleton.jsx'
import { useIndexPageHead } from '@/components/IndexPage/useIndexPageHead.js'

// /caves: every cenote, by area (each area's own page linked from its
// heading), those with no area last. Editors' list: /caves/edit.
export default function CaveIndex() {
  const { t } = useTranslation('indexPages')
  const { t: t404 } = useTranslation('404')
  const { data, loading, failed } = useIndexData()
  const groups = useMemo(() => groupByArea(data.caves, data.areasBySlug), [data])

  useIndexPageHead({ title: t('caves.title'), description: t('caves.description') })

  // A cave's system, muted after its name - left out when it's named like
  // the cave itself (a one-cave system), a leading "Cenote" aside.
  const bareName = (name) => (name || '').toLowerCase().replace(/^cenote\s+/, '').trim()
  const systemOf = (cave) => {
    const sistema = data.sistemasById.get(cave.sistemaId)
    return sistema && bareName(sistema.name) !== bareName(cave.name) ? sistema.name : null
  }

  if (loading) return <IndexPageSkeleton />

  return (
    <div className="oc-cave-index">
      <IndexPageHeader
        title={t('caves.title')}
        subtitle={
          <>
            {t('caveCount', { count: data.caves.length })}
            {' · '}
            <Link component={RouterLink} to="/sistemas" underline="hover">
              {t('sistemas.title')}
            </Link>
          </>
        }
        editTo="/caves/edit"
        editLabel={t('caves.edit')}
      />

      {failed && <Typography color="error">{t404('failed.description')}</Typography>}

      {groups.map(({ area, items }) => (
        <IndexSection
          key={area?.slug ?? 'unknown'}
          title={
            area ? (
              <Link component={RouterLink} to={`/areas/${area.slug}`} underline="hover" color="inherit">
                {area.name}
              </Link>
            ) : (
              t('unknownArea')
            )
          }
          count={t('caveCount', { count: items.length })}
        >
          <IndexLinkList items={items.map((cave) => ({ key: cave.id, to: `/map/${cave.id}`, label: cave.name || t('unnamedCave'), secondary: systemOf(cave) }))} />
        </IndexSection>
      ))}
    </div>
  )
}
