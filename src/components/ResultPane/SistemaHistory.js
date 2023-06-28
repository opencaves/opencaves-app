
import { useTranslation } from 'react-i18next'
import { Accordion, AccordionDetails, AccordionSummary, Box, SvgIcon, Typography } from '@mui/material'
import { ExpandMore } from '@mui/icons-material'
import Grid from '@mui/material/Unstable_Grid2'
import SubdirectoryArrowRightRoundedIcon from '@mui/icons-material/SubdirectoryArrowRightRounded'
import { getSistemaById } from '../../models/Sistema.js'
import { ReactComponent as CaveSystemIcon } from '../../images/cave-system.svg'
import { SISTEMA_DEFAULT_COLOR } from '../../config/map.js'

export default function Sistema({ sistemaHistory }) {

  const { t } = useTranslation('sistema')
  const { t: t2 } = useTranslation('resultPane')

  const hasSistemaAncestry = sistemaHistory.length > 1
  const currentSistema = getSistemaById(sistemaHistory[sistemaHistory.length - 1].id)

  if (hasSistemaAncestry) {
    return (
      <>
        {/* <Typography variant='caveDetailsSectionHeader'>{t('header')}</Typography> */}
        <Accordion
          variant='sistemaHistory'
          disableGutters
          elevation={0}
          square
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            disableRipple={false}
            variant='sistemaHistory'
          >
            <Box
              sx={{
                minWidth: 'var(--oc-details-icon-min-width)',
                display: 'inline-flex'
              }}
            >
              <SvgIcon
                component={CaveSystemIcon}
                inheritViewBox
                htmlColor={currentSistema.color ?? SISTEMA_DEFAULT_COLOR}
              />
            </Box>
            <Typography variant='caveDetailsItemText' component='div'>{t2('sistema', { system: currentSistema.name })}</Typography>
          </AccordionSummary>
          <AccordionDetails
            variant='sistemaHistory'
          >
            {
              sistemaHistory.map((sistema, i) => {
                const sistemaName = i === 0 ? `${t2('sistema', { system: sistema.name })}` : (
                  <Box>
                    <SubdirectoryArrowRightRoundedIcon sx={{ fontSize: 'inherit' }} />
                    {t2('sistema', { system: sistema.name })} {sistema.date && <Typography variant='mapTextSmall' sx={theme => ({ ml: theme.spacing(.5) })}>{sistema.date}</Typography>}
                  </Box>
                )
                return <div key={sistema.id} className='oc-results-sistemas--item' style={{ paddingInlineStart: `calc(var(--oc-results-sistemas--item-padding) * ${i})` }}>{sistemaName}</div>
              })
            }
          </AccordionDetails>
        </Accordion>
      </>
    )
  }

  return (
    <Grid container
      sx={{
        px: 'var(--oc-details-padding-inline)',
        py: 'var(--oc-details-padding-block)'
      }}>
      <Grid xs="auto">
        <Box sx={{ minWidth: 'var(--oc-details-icon-min-width)' }}>
          <SvgIcon component={CaveSystemIcon} inheritViewBox slot='start' className='cave-system-icon' htmlColor={currentSistema.color ?? 'red'}
          />
        </Box>
      </Grid>
      <Grid
        xs
      >
        <Typography variant='caveDetailsItemText'>{t2('sistema', { system: currentSistema.name })}</Typography>
      </Grid>
    </Grid>
  )
}