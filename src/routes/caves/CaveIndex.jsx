import { useMemo, useState } from 'react'
import pushId from 'unique-push-id'
import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Link, Typography } from '@mui/material'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import { groupByArea } from '@/utils/indexData.js'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import IndexSection from '@/components/IndexPage/IndexSection.jsx'
import IndexLinkList from '@/components/IndexPage/IndexLinkList.jsx'
import IndexPageSkeleton from '@/components/IndexPage/IndexPageSkeleton.jsx'
import IndexSearchField, { useIndexSearch } from '@/components/IndexPage/IndexSearchField.jsx'
import { useIndexPageHead } from '@/components/IndexPage/useIndexPageHead.js'

// /caves: every cenote, by area (each area's own page linked from its
// heading), those with no area last. Editors' list: /caves/edit.
export default function CaveIndex() {
  const { t } = useTranslation('indexPages')
  const { t: t404 } = useTranslation('404')
  const { data, loading, failed } = useIndexData()
  // The Add button's new record: one id per visit, not per render.
  const [newId] = useState(pushId)
  const { query, setQuery, matches, searching } = useIndexSearch()
  // The search: a cave's name and other names, its system's and its area's.
  const caves = useMemo(
    () => data.caves.filter((cave) => matches([cave.name, ...cave.aka, data.sistemasById.get(cave.sistemaId)?.name, cave.area])),
    [data, matches],
  )
  const groups = useMemo(() => groupByArea(caves, data.areasBySlug), [caves, data])

  useIndexPageHead({ title: t('caves.title'), description: t('caves.description') })

  // A cave's system, muted after its name - left out when it's named like
  // the cave itself (a one-cave system), a leading "Cenote" aside.
  const bareName = (name) => (name || '').toLowerCase().replace(/^cenote\s+/, '').trim()
  const systemOf = (cave) => {
    const sistema = data.sistemasById.get(cave.sistemaId)
    return sistema && bareName(sistema.name) !== bareName(cave.name) ? sistema.name : null
  }

  if (loading) return <IndexPageSkeleton search card />

  return (
    <div className="oc-cave-index">
      <IndexPageHeader
        trail={[{ label: t('menu.home', { ns: 'app' }), to: '/' }]}
        current={t('menu.caves', { ns: 'app' })}
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
        addTo={`/caves/${newId}/edit`}
        addLabel={t('caves.add')}
      />

      {failed && <Typography color="error">{t404('failed.description')}</Typography>}

      <IndexSearchField
        query={query}
        setQuery={setQuery}
        placeholder={t('search.caves')}
        status={searching ? (caves.length ? t('search.results', { count: caves.length }) : t('search.none', { query })) : null}
      />

      {groups.map(({ area, items }) => (
        <IndexSection
          card
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
          <IndexLinkList items={items.map((cave) => ({ key: cave.id, to: `/caves/${cave.id}`, mapTo: `/map/${cave.id}`, noMap: !cave.located, label: cave.name || t('unnamedCave'), secondary: systemOf(cave) }))} />
        </IndexSection>
      ))}
    </div>
  )
}
