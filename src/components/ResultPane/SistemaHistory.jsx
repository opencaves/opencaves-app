import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router-dom'
import { Accordion, AccordionDetails, AccordionSummary, Box, Link, Typography } from '@mui/material'
import ExpandMore from '@mui/icons-material/ExpandMoreRounded'
import { Grid } from '@mui/material'
import SubdirectoryArrowRightRoundedIcon from '@mui/icons-material/SubdirectoryArrowRightRounded'
import { getSistemaById } from '@/models/Sistema.js'
import CaveSystemIcon from '@/images/cave-system.svg?react'
import ExplorationHistory from './ExplorationHistory.jsx'
import { useSistemaSlugs } from '@/hooks/useIndexData.jsx'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map.js'
import SistemaArrow from '@/components/SistemaArrow.jsx'
import { RESULT_PANE_STICKY_TOP, SEARCH_BAR_MARGIN, SEARCH_BAR_RADIUS, SEARCH_BAR_SHADOW } from '@/config/app.js'

// A system's name as a link to its page (/sistemas/<id>), in the text's
// own look (underlined on hover); plain text when it has no page. Inside the
// accordion's header, following it doesn't also open or close the accordion.
function SistemaLink({ slug, children }) {
  if (!slug) return children
  return (
    <Link className="oc-sistema-history--link" component={RouterLink} to={`/sistemas/${slug}`} color="inherit" underline="hover" onClick={(event) => event.stopPropagation()}>
      {children}
    </Link>
  )
}

export default function Sistema({ sistemaHistory }) {
  // i18n: dates in the app's language (the browser's otherwise).
  const { t: t2, i18n } = useTranslation('resultPane')
  const slugs = useSistemaSlugs()

  const hasSistemaAncestry = sistemaHistory.length > 1
  // Whether the header is stuck under the search bar (its top at the sticky line).
  const summaryRef = useRef(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const node = summaryRef.current
    if (!node) return undefined
    const observer = new IntersectionObserver(([entry]) => setStuck(entry.intersectionRatio < 1 && entry.boundingClientRect.top <= RESULT_PANE_STICKY_TOP + 1), {
      rootMargin: `-${RESULT_PANE_STICKY_TOP + 1}px 0px 0px 0px`,
      threshold: [1],
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasSistemaAncestry])
  const latestSistema = sistemaHistory[sistemaHistory.length - 1]
  const currentSistema = getSistemaById(latestSistema.id) ?? latestSistema
  // Every system of the tree, as loaded (with its explorations).
  const sistemas = sistemaHistory.map((sistema) => getSistemaById(sistema.id) ?? sistema)

  if (hasSistemaAncestry) {
    return (
      <>
        {/* h2: a section of the cave (whose name is the h1), like "Access". */}
        <Accordion className="oc-sistema-history" variant="sistemaHistory" disableGutters elevation={0} square slotProps={{ heading: { component: 'h2' } }}>
          {/* Desktop pane: sticky under the floating search bar while the open
              tree and its history scroll by. */}
          <AccordionSummary
            expandIcon={<ExpandMore />}
            disableRipple={false}
            variant="sistemaHistory"
            ref={summaryRef}
            sx={(theme) => ({
              '.oc-result-pane-lg &': {
                position: 'sticky',
                top: RESULT_PANE_STICKY_TOP,
                zIndex: 1,
                // The pane's own surface (ResultPaneLg), over the text it hides.
                bgcolor: 'var(--oc-result-pane-surface-color, var(--mui-palette-background-paper))',
                // Stuck: the space above it (behind and under the search bar)
                // filled, so the text scrolling by doesn't show there; and the
                // header floats like the search bar - its card (inset as the
                // bar is), rounded and shadowed, behind its content.
                ...(stuck && {
                  bgcolor: 'transparent',
                  '&::before': { content: '""', position: 'absolute', left: 0, right: 0, bottom: '100%', height: RESULT_PANE_STICKY_TOP, bgcolor: 'var(--oc-result-pane-surface-color, var(--mui-palette-background-paper))' },
                  '&::after': { content: '""', position: 'absolute', inset: `0 ${SEARCH_BAR_MARGIN}px`, zIndex: -1, borderRadius: SEARCH_BAR_RADIUS, boxShadow: SEARCH_BAR_SHADOW, bgcolor: theme.vars.palette.background.paper },
                }),
              },
            })}
          >
            <Box
              sx={{
                minWidth: 'var(--oc-details-icon-min-width)',
                display: 'inline-flex',
              }}
            >
              <CaveSystemIcon className="oc-cave-system-icon" style={{ color: currentSistema.color ?? SISTEMA_DEFAULT_COLOR }} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {/* Not grown to the icon's height (the variant's flex): its line
                  would sit at the top, above the icon and the arrow. */}
              {/* Plain text: the whole header opens the dropdown, whose systems
                  link to their pages. */}
              <Typography variant="caveDetailsItemText" component="div" sx={{ flex: 'none' }}>
                {t2('sistema', { system: currentSistema.name })}
              </Typography>
              {currentSistema.createdAt && (
                <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  {new Date(currentSistema.createdAt.toDate?.() ?? currentSistema.createdAt).toLocaleDateString(i18n.resolvedLanguage)}
                </Typography>
              )}
            </Box>
          </AccordionSummary>
          {/* Under the header ("… system"): the names, each after its
              system's line arrow, in its colour. */}
          <AccordionDetails variant="sistemaHistory">
            {sistemaHistory.map((sistema, i) => {
              const arrow = <SistemaArrow color={sistemas[i].color} sx={{ mr: 0.75 }} />
              const sistemaName =
                i === 0 ? (
                  <Typography variant="caveDetailsItemText">
                    {arrow}
                    <SistemaLink slug={slugs.get(sistema.id)}>{sistema.name}</SistemaLink>
                  </Typography>
                ) : (
                  <Box>
                    <SubdirectoryArrowRightRoundedIcon sx={{ fontSize: 'inherit' }} />
                    <Typography variant="caveDetailsItemText">
                      {arrow}
                      <SistemaLink slug={slugs.get(sistema.id)}>{sistema.name}</SistemaLink>
                    </Typography>{' '}
                    {sistema.date && (
                      <Typography variant="mapTextSmall" sx={(theme) => ({ ml: theme.spacing(0.5) })}>
                        {sistema.date}
                      </Typography>
                    )}
                  </Box>
                )
              return (
                <div key={sistema.id} className="oc-results-sistemas--item" style={{ paddingInlineStart: `calc(var(--oc-results-sistemas--item-padding) * ${i})` }}>
                  {sistemaName}
                </div>
              )
            })}
            <ExplorationHistory sistemas={sistemas} />
          </AccordionDetails>
        </Accordion>
      </>
    )
  }

  return (
    <Grid
      className="oc-sistema-history"
      container
      sx={{
        px: 'var(--oc-pane-padding-inline)',
        py: 'var(--oc-pane-padding-block)',
      }}
    >
      <Grid size="auto">
        <Box sx={{ minWidth: 'var(--oc-details-icon-min-width)' }}>
          <CaveSystemIcon className="oc-cave-system-icon" style={{ color: currentSistema.color ?? SISTEMA_DEFAULT_COLOR }} />
        </Box>
      </Grid>
      <Grid size="grow">
        <Box>
          <Typography variant="caveDetailsItemText">
            <SistemaLink slug={slugs.get(currentSistema.id)}>{t2('sistema', { system: currentSistema.name })}</SistemaLink>
          </Typography>
          {currentSistema.createdAt && (
            <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              {new Date(currentSistema.createdAt.toDate?.() ?? currentSistema.createdAt).toLocaleDateString(i18n.resolvedLanguage)}
            </Typography>
          )}
        </Box>
      </Grid>
    </Grid>
  )
}
