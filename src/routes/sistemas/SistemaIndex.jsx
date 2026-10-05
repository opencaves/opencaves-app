import { useMemo, useState } from 'react'
import pushId from 'unique-push-id'
import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Link, Typography } from '@mui/material'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import { groupByArea } from '@/utils/indexData.js'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map.js'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import IndexSearchField, { useIndexSearch } from '@/components/IndexPage/IndexSearchField.jsx'
import IndexSection from '@/components/IndexPage/IndexSection.jsx'
import IndexLinkList from '@/components/IndexPage/IndexLinkList.jsx'
import IndexPageSkeleton from '@/components/IndexPage/IndexPageSkeleton.jsx'
import { useIndexPageHead } from '@/components/IndexPage/useIndexPageHead.js'

// /sistemas: every cave system, by its own area, those with none last.
// Editors' list: /sistemas/edit.
export default function SistemaIndex() {
  const { t } = useTranslation('indexPages')
  const { t: t404 } = useTranslation('404')
  const { data, loading, failed } = useIndexData()
  // The Add button's new record: one id per visit, not per render.
  const [newId] = useState(pushId)
  const { query, setQuery, matches, searching } = useIndexSearch()
  // The search: a system's name and other names, and its area's.
  const sistemas = useMemo(
    () => data.sistemas.filter((sistema) => matches([sistema.name, ...(Array.isArray(sistema.aka) ? sistema.aka : []), sistema.area])),
    [data, matches],
  )
  const groups = useMemo(() => groupByArea(sistemas, data.areasBySlug), [sistemas, data])

  useIndexPageHead({ title: t('sistemas.title'), description: t('sistemas.description') })

  if (loading) return <IndexPageSkeleton />

  return (
    <div className="oc-sistema-index">
      <IndexPageHeader
        title={t('sistemas.title')}
        subtitle={
          <>
            {t('sistemaCount', { count: data.sistemas.length })}
            {' · '}
            <Link component={RouterLink} to="/caves" underline="hover">
              {t('caves.title')}
            </Link>
          </>
        }
        addTo={`/sistemas/${newId}/edit`}
        addLabel={t('sistemas.add')}
      />

      {failed && <Typography color="error">{t404('failed.description')}</Typography>}

      <IndexSearchField
        query={query}
        setQuery={setQuery}
        placeholder={t('search.sistemas')}
        status={searching ? (sistemas.length ? t('search.results', { count: sistemas.length }) : t('search.none', { query })) : null}
      />

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
          count={t('sistemaCount', { count: items.length })}
        >
          <IndexLinkList items={items.map((sistema) => ({ key: sistema.id, to: `/sistemas/${sistema.slug}`, label: sistema.name, color: sistema.color || SISTEMA_DEFAULT_COLOR }))} />
        </IndexSection>
      ))}
    </div>
  )
}
