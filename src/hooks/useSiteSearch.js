import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import { foldSearch, searchMatcher } from '@/utils/searchText.js'

// How many suggestions show at once.
const MAX_SUGGESTIONS = 8
// The kinds' order in the suggestions.
const KIND_ORDER = ['areas', 'sistemas', 'caves']

// Names compared as every search of the site does (utils/searchText.js).
const fold = foldSearch

// The site's search (SiteSearch on the landing page, AppBarSearch in the app
// bar): the suggestions for what's typed - every word found, names starting
// with it first, grouped by kind - among the caves and cave systems, plus
// the areas when asked. Each has a label, maybe a secondary text, and where
// it leads.
export function useSiteSearch(input, { areas = false } = {}) {
  const { t } = useTranslation('indexPages')
  const { data } = useIndexData()

  // Every searchable thing once: its label, the texts it's found by, where it leads.
  const entries = useMemo(
    () => [
      ...data.caves.map((cave) => {
        const sistema = data.sistemasById.get(cave.sistemaId)?.name
        // Its system beside it, unless named like the cave (a leading "Cenote" aside), as on /caves.
        const bare = (name) => fold(name).replace(/^cenote\s+/, '').trim()
        const secondary = sistema && bare(sistema) !== bare(cave.name) ? sistema : null
        return { kind: 'caves', id: `c-${cave.id}`, label: cave.name || t('unnamedCave'), secondary, to: `/caves/${cave.id}`, haystack: fold([cave.name, ...(cave.aka || []), sistema].join(' ')) }
      }),
      ...data.sistemas.map((sistema) => ({ kind: 'sistemas', id: `s-${sistema.id}`, label: sistema.name, to: `/sistemas/${sistema.slug}`, haystack: fold([sistema.name, ...(Array.isArray(sistema.aka) ? sistema.aka : [])].join(' ')) })),
      ...(areas ? data.areas.filter((area) => area.caves.length > 0).map((area) => ({ kind: 'areas', id: `a-${area.slug}`, label: area.name, to: `/caves#${area.slug}`, haystack: fold(area.name) })) : []),
    ],
    [data, areas, t],
  )

  return useMemo(() => {
    const query = fold(input)
    if (!query) return []
    const matches = searchMatcher(input)
    const found = entries
      .filter((entry) => matches(entry.haystack))
      .sort((a, b) => fold(b.label).startsWith(query) - fold(a.label).startsWith(query) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
      .slice(0, MAX_SUGGESTIONS)
      // Grouped by kind for the list (groupBy needs them together).
      .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    // Nothing found: said, with the full list's search (the suggestions
    // showed nothing at all - freeSolo hides the no-options text).
    if (found.length === 0) return [{ kind: 'none', id: 'none', label: t('searchNoResult', { query: input.trim() }), to: `/caves?q=${encodeURIComponent(input.trim())}` }]
    return found
  }, [entries, input, t])
}
