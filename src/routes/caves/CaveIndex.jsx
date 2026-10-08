import { useMemo, useState } from 'react'
import pushId from 'unique-push-id'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import { groupByArea } from '@/utils/indexData.js'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import IndexSection from '@/components/IndexPage/IndexSection.jsx'
import IndexLinkList from '@/components/IndexPage/IndexLinkList.jsx'
import IndexPageSkeleton from '@/components/IndexPage/IndexPageSkeleton.jsx'
import IndexSearchField, { fold, useIndexSearch, useProgressiveCount } from '@/components/IndexPage/IndexSearchField.jsx'
import { useIndexPageHead } from '@/components/IndexPage/useIndexPageHead.js'

// /caves: every cenote, by area (each area's own page linked from its
// heading), those with no area last. Editors' list: /caves/edit.
export default function CaveIndex() {
  const { t } = useTranslation('indexPages')
  const { t: t404 } = useTranslation('404')
  const { data, loading, failed } = useIndexData()
  // The Add button's new record: one id per visit, not per render.
  const [newId] = useState(pushId)
  const { query, setQuery, matchesFolded, searching, searchedQuery } = useIndexSearch()

  // Every cave's row, and its search text (its name and other names, its
  // system's and its area's), made once - not on every letter typed.
  const rows = useMemo(() => {
    // A cave's system, muted after its name - left out when it's named like
    // the cave itself (a one-cave system), a leading "Cenote" aside.
    const bareName = (name) => (name || '').toLowerCase().replace(/^cenote\s+/, '').trim()
    return new Map(
      data.caves.map((cave) => {
        const sistema = data.sistemasById.get(cave.sistemaId)
        const row = { key: cave.id, cave: true, to: `/caves/${cave.id}`, mapTo: `/map/${cave.id}`, noMap: !cave.located, label: cave.name || t('unnamedCave'), secondary: sistema && bareName(sistema.name) !== bareName(cave.name) ? sistema.name : null }
        return [cave.id, { row, text: fold([cave.name, ...cave.aka, sistema?.name, cave.area].join(' ')) }]
      }),
    )
  }, [data, t])
  const caves = useMemo(() => data.caves.filter((cave) => matchesFolded(rows.get(cave.id).text)), [data, rows, matchesFolded])
  // Each area's rows: the same arrays until the search changes (the lists
  // aren't drawn again meanwhile).
  const groups = useMemo(() => groupByArea(caves, data.areasBySlug).map(({ area, items }) => ({ area, items, rows: items.map((cave) => rows.get(cave.id).row) })), [caves, data, rows])
  const shownGroups = useProgressiveCount(groups.length, groups)

  useIndexPageHead({ title: t('caves.title'), description: t('caves.description') })

  if (loading) return <IndexPageSkeleton search card />

  return (
    <div className="oc-cave-index">
      <IndexPageHeader
        trail={[{ label: t('menu.home', { ns: 'app' }), to: '/' }]}
        current={t('menu.caves', { ns: 'app' })}
        title={t('caves.title')}
        // Short: its count, by area (the systems' list is in the menu).
        subtitle={t('caves.subtitle', { count: data.caves.length })}
        addTo={`/caves/${newId}/edit`}
        addLabel={t('caves.add')}
      />

      {failed && <Typography color="error">{t404('failed.description')}</Typography>}

      <IndexSearchField
        query={query}
        setQuery={setQuery}
        placeholder={t('search.cavesShort')}
        label={t('search.caves')}
        status={searching ? (caves.length ? t('search.results', { count: caves.length }) : t('search.none', { query: searchedQuery })) : null}
      />

      {groups.slice(0, shownGroups).map(({ area, items, rows: groupRows }) => (
        <IndexSection
          card
          lazy
          stickyTitle
          key={area?.slug ?? 'unknown'}
          // Its anchor: the area's slug (#akumal) - where an area's links lead.
          id={area?.slug ?? 'no-area'}
          // Its name alone: an area has no page of its own (its # links here).
          title={area ? area.name : t('unknownArea')}
          count={t('caveCount', { count: items.length })}
        >
          <IndexLinkList items={groupRows} />
        </IndexSection>
      ))}
    </div>
  )
}
