import { useMemo, useState } from 'react'
import pushId from 'unique-push-id'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import { groupByArea } from '@/utils/indexData.js'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map.js'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import IndexSearchField, { fold, useIndexSearch, useProgressiveCount } from '@/components/IndexPage/IndexSearchField.jsx'
import IndexSection from '@/components/IndexPage/IndexSection.jsx'
import IndexLinkList from '@/components/IndexPage/IndexLinkList.jsx'
import IndexPageSkeleton from '@/components/IndexPage/IndexPageSkeleton.jsx'
import { useIndexPageHead } from '@/components/IndexPage/useIndexPageHead.js'

/**
 * /sistemas: every cave system, by its own area, those with none last.
 * Editors' list: /sistemas/edit.
 */
export default function SistemaIndex() {
  const { t } = useTranslation('indexPages')
  const { t: t404 } = useTranslation('404')
  const { data, loading, failed } = useIndexData()
  // The Add button's new record: one id per visit, not per render.
  const [newId] = useState(pushId)
  const { query, setQuery, matchesFolded, searching, searchedQuery } = useIndexSearch()

  // Every system's row, and its search text (its name and other names, and
  // its area's), made once - not on every letter typed.
  const rows = useMemo(
    () => new Map(data.sistemas.map((sistema) => [sistema.id, { row: { key: sistema.id, to: `/sistemas/${sistema.slug}`, label: sistema.name, color: sistema.color || SISTEMA_DEFAULT_COLOR }, text: fold([sistema.name, ...(Array.isArray(sistema.aka) ? sistema.aka : []), sistema.area].join(' ')) }])),
    [data],
  )
  const sistemas = useMemo(() => data.sistemas.filter((sistema) => matchesFolded(rows.get(sistema.id).text)), [data, rows, matchesFolded])
  // Each area's rows: the same arrays until the search changes.
  const groups = useMemo(() => groupByArea(sistemas, data.areasBySlug).map(({ area, items }) => ({ area, items, rows: items.map((sistema) => rows.get(sistema.id).row) })), [sistemas, data, rows])
  const shownGroups = useProgressiveCount(groups.length, groups)

  useIndexPageHead({ title: t('sistemas.title'), description: t('sistemas.description') })

  if (loading) return <IndexPageSkeleton search card />

  return (
    <div className="oc-sistema-index">
      <IndexPageHeader
        trail={[{ label: t('menu.home', { ns: 'app' }), to: '/' }]}
        current={t('menu.sistemas', { ns: 'app' })}
        title={t('sistemas.title')}
        // Short: its count, by area (the caves' list is in the menu).
        subtitle={t('sistemas.subtitle', { count: data.sistemas.length })}
        addTo={`/sistemas/${newId}/edit`}
        addLabel={t('sistemas.add')}
      />

      {failed && <Typography color="error">{t404('failed.description')}</Typography>}

      <IndexSearchField
        query={query}
        setQuery={setQuery}
        placeholder={t('search.sistemasShort')}
        label={t('search.sistemas')}
        status={searching ? (sistemas.length ? t('search.results', { count: sistemas.length }) : t('search.none', { query: searchedQuery })) : null}
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
          count={t('sistemaCount', { count: items.length })}
        >
          <IndexLinkList items={groupRows} />
        </IndexSection>
      ))}
    </div>
  )
}
