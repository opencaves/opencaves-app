import { useMemo } from 'react'
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Link, Typography } from '@mui/material'
import SubdirectoryArrowRightRoundedIcon from '@mui/icons-material/SubdirectoryArrowRightRounded'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import { useUnits } from '@/hooks/useUnits.jsx'
import { buildSistemaAncestryComputer } from '@/services/data-service/postProcessCaveData.js'
import { formatMeasure } from '@/utils/units.js'
import { slugify } from '@/utils/slug.js'
import { markdownToPlainText, truncate } from '@/utils/seo.js'
import Markdown from '@/components/Markdown/Markdown.jsx'
import ExplorationHistory from '@/components/ResultPane/ExplorationHistory.jsx'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import IndexSection from '@/components/IndexPage/IndexSection.jsx'
import MapsSection from '@/components/IndexPage/MapsSection.jsx'
import IndexLinkList from '@/components/IndexPage/IndexLinkList.jsx'
import IndexPageSkeleton from '@/components/IndexPage/IndexPageSkeleton.jsx'
import { useIndexPageHead } from '@/components/IndexPage/useIndexPageHead.js'
import SistemaCookie from '@/components/SistemaCookie.jsx'
import SistemaArrow from '@/components/SistemaArrow.jsx'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'
import { throwNotFound } from '@/components/IndexPage/notFound.js'


const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })

// A system's name: a link to its page, or plain text when it has none (not
// public).
function SistemaName({ sistema, name }) {
  const arrow = <SistemaArrow color={sistema?.color} sx={{ mr: 0.75 }} />
  if (!sistema?.slug) return <span>{arrow}{name}</span>
  return (
    <span>
      {arrow}
      <Link component={RouterLink} to={`/sistemas/${sistema.slug}`} underline="hover">
        {sistema.name}
      </Link>
    </span>
  )
}

// What the page shows besides the system's own fields: its area, its tree
// (the systems it joined, those that joined it), and its cenotes.
function sistemaDetails(sistema, data) {
  const area = sistema.area ? data.areasBySlug.get(slugify(sistema.area)) || null : null
  // This system, then each system it joined in turn, with the dates (as a
  // cave's system tree in the details pane).
  const ancestry = buildSistemaAncestryComputer(data.sistemas, data.connections)({ sistemaId: sistema.id, sistemaColor: sistema.color }) || []
  const childrenByParent = new Map()
  data.connections.forEach((connection) => {
    if (!childrenByParent.has(connection.parentSistemaId)) childrenByParent.set(connection.parentSistemaId, [])
    childrenByParent.get(connection.parentSistemaId).push(connection)
  })
  const children = (childrenByParent.get(sistema.id) || [])
    .map((connection) => ({ id: connection.sistemaId, sistema: data.sistemasById.get(connection.sistemaId), date: connection.connectionDate }))
    .filter((child) => child.sistema)
    .sort((a, b) => byName(a.sistema, b.sistema))
  // Its cenotes: its own, and those of every system that joined it.
  const memberIds = new Set([sistema.id])
  const queue = [sistema.id]
  while (queue.length > 0) {
    const joined = childrenByParent.get(queue.shift()) || []
    joined.forEach(({ sistemaId }) => {
      if (!memberIds.has(sistemaId)) {
        memberIds.add(sistemaId)
        queue.push(sistemaId)
      }
    })
  }
  const caves = data.caves.filter((cave) => memberIds.has(cave.sistemaId))
  // Its exploration history, with that of the systems it joined (as the
  // details pane shows it for a cave of this system).
  const historySistemas = ancestry.map(({ id }) => data.sistemasById.get(id)).filter(Boolean)
  return { area, ancestry, children, caves, historySistemas }
}

// /sistemas/<id>: a cave system - its area, length and depth, description,
// connections, exploration history and cenotes. Editors edit it at
// /sistemas/<id>/edit.
export default function SistemaPage() {
  const { sistemaId } = useParams()
  const { t, i18n } = useTranslation('indexPages')
  const { t: tPane } = useTranslation('resultPane')
  const units = useUnits()
  const { data, loading } = useIndexData()
  const sistema = data.sistemasById.get(sistemaId)
  const details = useMemo(() => (sistema ? sistemaDetails(sistema, data) : null), [sistema, data])

  const title = sistema ? t('sistema.title', { name: sistema.name }) : null
  const summary = sistema ? markdownToPlainText(sistema.description) : ''
  const description = sistema ? truncate(summary ? `${t('sistema.descriptionPrefix', { name: sistema.name })} ${summary}` : t('sistema.description', { name: sistema.name })) : null
  useIndexPageHead({ title, description })

  if (loading) return <IndexPageSkeleton item back />
  if (!sistema) {
    // A system's name in the address (as the pages first did): its id.
    const match = data.sistemas.find((candidate) => slugify(candidate.name) === slugify(sistemaId))
    if (match) return <Navigate to={`/sistemas/${match.slug}`} replace />
    throwNotFound()
  }

  const { area, ancestry, children, caves, historySistemas } = details
  const facts = [
    area && {
      key: 'area',
      label: t('sistema.area'),
      value: (
        <Link component={RouterLink} to={`/areas/${area.slug}`} underline="hover">
          {area.name}
        </Link>
      ),
    },
    sistema.length > 0 && { key: 'length', label: t('sistema.length'), value: formatMeasure(sistema.length, units, i18n.language) },
    sistema.maxDepth > 0 && { key: 'maxDepth', label: t('sistema.maxDepth'), value: formatMeasure(sistema.maxDepth, units, i18n.language) },
  ].filter(Boolean)
  const hasHistory = historySistemas.some((s) => (s.explorations || []).some((e) => e.date || e.team || e.description))

  return (
    <div className="oc-sistema-page">
      <IndexPageHeader
        trail={[{ label: t('menu.home', { ns: 'app' }), to: '/' }, { label: t('menu.sistemas', { ns: 'app' }), to: '/sistemas' }]}
        current={sistema.name}
        title={
          <>
            <SistemaCookie color={sistema.color} sx={{ fontSize: '1.1em', mr: 1 }} />
            {title}
          </>
        }
        subtitle={sistema.aka?.length > 0 ? `${tPane('aka')} ${sistema.aka.join(', ')}` : null}
        backTo="/sistemas"
        editTo={`/sistemas/${sistema.slug}/edit`}
        editLabel={t('sistema.edit', { name: sistema.name })}
      />

      {facts.length > 0 && (
        <Box component="dl" className="oc-sistema-page--facts" sx={{ ...DASHBOARD_SURFACE_SX, p: { xs: 2, sm: 3 }, display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 3, rowGap: 1, m: 0, mb: 3 }}>
          {facts.map(({ key, label, value }) => (
            <Box key={key} sx={{ display: 'contents' }}>
              <Typography component="dt" variant="body2" sx={{ color: 'text.secondary', alignSelf: 'baseline' }}>
                {label}
              </Typography>
              <Typography component="dd" sx={{ m: 0, alignSelf: 'baseline' }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {sistema.description && (
        <IndexSection title={t('sistema.about')} className="oc-sistema-page--description" card>
          <Box sx={{ typography: 'body1', '& > :first-child': { mt: 0 }, '& > :last-child': { mb: 0 } }}>
            <Markdown>{sistema.description}</Markdown>
          </Box>
        </IndexSection>
      )}

      {(ancestry.length > 1 || children.length > 0) && (
        <IndexSection title={t('sistema.connections')} className="oc-sistema-page--connections" card>
          {ancestry.length > 1 && (
            <Box sx={{ mb: children.length > 0 ? 2 : 0 }}>
              <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>
                {t('sistema.partOf')}
              </Typography>
              {/* Indented a step per system joined, as the details pane's tree. */}
              {ancestry.map((item, index) => (
                <Box key={item.id} className="oc-sistema-page--tree-item" sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 0.5, py: 0.25, pl: index * 2.5 }}>
                  {index > 0 && <SubdirectoryArrowRightRoundedIcon sx={{ fontSize: '1rem', alignSelf: 'center', color: 'text.secondary' }} />}
                  {index === 0 ? (
                    <Typography component="span" sx={{ fontWeight: 500 }}>
                      <SistemaArrow color={sistema.color} sx={{ mr: 0.75 }} />
                      {sistema.name}
                    </Typography>
                  ) : (
                    <SistemaName sistema={data.sistemasById.get(item.id)} name={item.name} />
                  )}
                  {item.date && (
                    <Typography component="span" variant="body2" sx={{ color: 'text.secondary', ml: 0.5 }}>
                      {item.date}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}
          {children.length > 0 && (
            <Box>
              <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>
                {t('sistema.joinedBy')}
              </Typography>
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, columnWidth: '14rem', columnGap: 4, '& > li': { breakInside: 'avoid', py: 0.25 } }}>
                {children.map((child) => (
                  <li key={child.id}>
                    <SistemaName sistema={child.sistema} name={child.sistema.name} />
                    {child.date && (
                      <Typography component="span" variant="body2" sx={{ color: 'text.secondary', ml: 1 }}>
                        {child.date}
                      </Typography>
                    )}
                  </li>
                ))}
              </Box>
            </Box>
          )}
        </IndexSection>
      )}

      {/* Opened in the viewer of one of the system's own caves (the viewer
          lives under a cave's address), a located one first. */}
      <MapsSection
        sistemaId={sistema.id}
        sistemas={data.sistemas}
        connections={data.connections}
        caveId={(caves.find((cave) => cave.sistemaId === sistema.id && cave.located) || caves.find((cave) => cave.sistemaId === sistema.id))?.id}
        title={t('maps')}
        card
      />

      {hasHistory && (
        // ExplorationHistory lines up with the details pane's icons there;
        // here, with the page.
        <IndexSection title={tPane('explorationHistory')} className="oc-sistema-page--history" card>
          {/* Without the entries' sources (their notes); its title is the section's. */}
          <Box sx={{ '& .oc-exploration-history': { mt: 0, ml: 0 } }}>
            <ExplorationHistory sistemas={historySistemas} showNotes={false} showHeading={false} />
          </Box>
        </IndexSection>
      )}

      <IndexSection title={t('sistema.cenotes')} count={caves.length} className="oc-sistema-page--cenotes" card>
        {caves.length > 0 ? (
          <IndexLinkList items={caves.map((cave) => ({ key: cave.id, to: `/caves/${cave.id}`, mapTo: `/map/${cave.id}`, noMap: !cave.located, label: cave.name || t('unnamedCave') }))} />
        ) : (
          <Typography sx={{ color: 'text.secondary' }}>{t('sistema.noCenotes')}</Typography>
        )}
      </IndexSection>
    </div>
  )
}
