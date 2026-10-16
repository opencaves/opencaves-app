import { useCallback, useEffect, useMemo, useState } from 'react'
import pushId from 'unique-push-id'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import { groupByArea } from '@/utils/indexData.js'
import { MISSING_CRITERIA, TYPE_VALUES, UNKNOWN_VALUE, caveFiltersParams, caveValue, emptyCaveFilters, matchesCaveFilters, noCaveFilters, parseCaveFilters, sameCaveFilterParams, withCaveFilter } from '@/utils/caveFilters.js'
import { useCoverCaveIds } from '@/models/CaveAsset.js'
import CaveFilterBar from './CaveFilterBar.jsx'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import IndexSection from '@/components/IndexPage/IndexSection.jsx'
import IndexLinkList from '@/components/IndexPage/IndexLinkList.jsx'
import IndexPageSkeleton from '@/components/IndexPage/IndexPageSkeleton.jsx'
import IndexSearchField, { fold, useIndexSearch, useProgressiveCount } from '@/components/IndexPage/IndexSearchField.jsx'
import { useIndexPageHead } from '@/components/IndexPage/useIndexPageHead.js'
import { useReviewMonth } from '@/hooks/useReviewMonth.js'

// A kind's values in their address order: by id, unknown last.
const byIdUnknownLast = (a, b) => (a === UNKNOWN_VALUE ? 1 : b === UNKNOWN_VALUE ? -1 : a.localeCompare(b))

/**
 * /caves: every cave, by area, those with no area last; filtered by the
 * address's criteria (utils/caveFilters.js: ?type=entrance&missing=photo...,
 * the older ?filter=unnamed or ?filter=no-coordinates rewritten as such),
 * shown as chips with an Add filter menu (CaveFilterBar), with the text
 * search. The server renders the address with its query
 * (functions/js/seo/ssr.js): the first render is filtered on both sides, with
 * the facts pageState.js sends and the covers query's results. Editors'
 * list: /caves/edit.
 */
export default function CaveIndex() {
  const { t } = useTranslation('indexPages')
  const { t: t404 } = useTranslation('404')
  const { data, loading, failed } = useIndexData()
  // The Add button's new record: one id per visit, not per render.
  const [newId] = useState(pushId)
  const { query, setQuery, matchesFolded, matchesId, searching, searchedQuery } = useIndexSearch()
  const { t: tFilter } = useTranslation('filter')
  const [searchParams, setSearchParams] = useSearchParams()
  // The caves with photos (their cover's), for the No photo filter.
  const { caveIds: covers, error: coversError } = useCoverCaveIds()

  // Each kind's values (the menu's items, and what the address may hold):
  // the areas with caves (by slug, alphabetically), the accesses and
  // accessibilities the caves have or the app names.
  const options = useMemo(() => {
    const labels = (kind) => new Map((/** @type {{key: string, label: string}[]} */ (tFilter(`${kind}.items`, { returnObjects: true })) || []).map(({ key, label }) => [key, label]))
    const listOf = (kind) => {
      const named = labels(kind)
      const values = [...new Set([...named.keys(), ...data.caves.map((cave) => caveValue(cave, kind))])].sort(byIdUnknownLast)
      return values.map((value) => ({ value, label: named.get(value) || value, chip: tFilter(`${kind}.chip`, { label: named.get(value) || value }) }))
    }
    const areas = data.areas.filter((area) => area.caves.length > 0).map(({ slug, name }) => ({ value: slug, label: name }))
    if (data.caves.some((cave) => !cave.area)) areas.push({ value: UNKNOWN_VALUE, label: tFilter('areas.unknown') })
    return {
      missing: MISSING_CRITERIA.map(({ value }) => ({ value, label: tFilter(`needsHelp.items.${value}`) })),
      type: TYPE_VALUES.map((value) => ({ value, label: tFilter(`cenoteType.${value}`) })),
      area: areas,
      access: listOf('access'),
      accessibility: listOf('accessibility'),
    }
  }, [data, tFilter])
  const filters = useMemo(
    () => (loading ? emptyCaveFilters() : parseCaveFilters(searchParams, { area: options.area.map(({ value }) => value), access: options.access.map(({ value }) => value), accessibility: options.accessibility.map(({ value }) => value) })),
    [searchParams, options, loading],
  )
  const filtered = !noCaveFilters(filters)
  // The address written anew for filters: in its fixed order, the text search last.
  const setFilters = useCallback((next) => setSearchParams((params) => caveFiltersParams(next, params.get('q')), { replace: true, preventScrollReset: true }), [setSearchParams])
  // An address whose filters aren't written the way the page writes them
  // (the older ?filter=, another order, unknown values): written anew, so
  // the same filters have one address.
  useEffect(() => {
    if (!loading && !sameCaveFilterParams(searchParams, filters)) setFilters(filters)
  }, [loading, searchParams, filters, setFilters])
  // No photo asked for, before the covers are known: the list waits (the
  // server's page has them: no wait there, nor in its hydration).
  const photosPending = filters.missing.includes('photo') && !covers && !coversError

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
  // The caves the text search finds (by their words, or by (a piece of)
  // their id), then those the filters keep.
  const searched = useMemo(() => data.caves.filter((cave) => matchesFolded(rows.get(cave.id).text) || matchesId(cave.id)), [data, rows, matchesFolded, matchesId])
  // The month confirmations' age is counted in: the server's until hydrated.
  const month = useReviewMonth()
  const caves = useMemo(() => (filtered ? searched.filter((cave) => matchesCaveFilters(cave, filters, covers, month)) : searched), [searched, filters, filtered, covers, month])
  // The menu's counts: how many caves the list shows with a value added.
  const countWith = useCallback(
    (kind, value) => {
      if (kind === 'missing' && value === 'photo' && !covers) return null
      const next = withCaveFilter(filters, kind, value)
      return searched.reduce((count, cave) => count + Number(matchesCaveFilters(cave, next, covers, month)), 0)
    },
    [searched, filters, covers, month],
  )
  const order = (kind) => options[kind].map(({ value }) => value)
  const onToggle = (kind, value, on) => setFilters(withCaveFilter(filters, kind, value, on, order(kind)))
  // Each area's rows: the same arrays until the search changes (the lists
  // aren't drawn again meanwhile).
  const groups = useMemo(() => groupByArea(caves, data.areasBySlug).map(({ area, items }) => ({ area, items, rows: items.map((cave) => rows.get(cave.id).row) })), [caves, data, rows])
  const shownGroups = useProgressiveCount(groups.length, groups)

  useIndexPageHead({ title: t('caves.title'), description: t('caves.description') })

  if (loading || photosPending) return <IndexPageSkeleton search card />

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
        status={searching ? (caves.length ? t('search.results', { count: caves.length }) : t('search.none', { query: searchedQuery })) : filtered ? t('caves.filters.count', { count: caves.length }) : null}
      />

      <CaveFilterBar filters={filters} options={options} onToggle={onToggle} onClear={() => setFilters(emptyCaveFilters())} countWith={countWith} />

      {filters.missing.includes('photo') && coversError && <Typography color="error" sx={{ mb: 2 }}>{t('caves.filters.photosFailed')}</Typography>}

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
