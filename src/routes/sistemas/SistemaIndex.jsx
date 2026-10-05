import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Link, Typography } from '@mui/material'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import { groupByArea } from '@/utils/indexData.js'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map.js'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
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
  const groups = useMemo(() => groupByArea(data.sistemas, data.areasBySlug), [data])

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
        editTo="/sistemas/edit"
        editLabel={t('sistemas.edit')}
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
          count={t('sistemaCount', { count: items.length })}
        >
          <IndexLinkList items={items.map((sistema) => ({ key: sistema.id, to: `/sistemas/${sistema.slug}`, label: sistema.name, color: sistema.color || SISTEMA_DEFAULT_COLOR }))} />
        </IndexSection>
      ))}
    </div>
  )
}
