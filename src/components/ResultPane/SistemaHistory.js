
import { useTranslation } from 'react-i18next'
import { IonAccordionGroup, IonAccordion, IonItem, IonLabel, IonIcon, IonNote } from '@ionic/react'
import { returnDownForward } from 'ionicons/icons'
import { Accordion, AccordionDetails, AccordionSummary, Box, SvgIcon, Typography } from '@mui/material'
import { getSistemaById } from '../../models/Sistema.js'
import { ReactComponent as CaveSystemIcon } from '../../images/cave-system.svg'
import { ExpandMore } from '@mui/icons-material'
import './SistemaHistory.scss'

export default function Sistema({ sistemaHistory }) {

  const { t } = useTranslation('sistemaHistory')
  const { t: t2 } = useTranslation('resultPane')

  const hasSistemaAncestry = sistemaHistory.length > 1
  const currentSistema = getSistemaById(sistemaHistory[sistemaHistory.length - 1].id)

  if (hasSistemaAncestry) {
    return (
      <>
        <Accordion className='oc-sistema-history' disableGutters elevation={0} square>
          <AccordionSummary
            expandIcon={<ExpandMore />}
            disableRipple={false}
            variant='sistemaHistory'
          >
            <Box className='oc-sistema-history--icon'>
              <SvgIcon component={CaveSystemIcon} inheritViewBox slot='start' className='cave-system-icon' htmlColor={currentSistema.color ?? 'red'} />
            </Box>
            <Typography variant='caveDetailsItemText'>{t2('sistema', { system: currentSistema.name })}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant='sistemaHistoryHeader'>{t('header')}</Typography>
            {
              sistemaHistory.map((sistema, i) => {
                const sistemaName = i === 0 ? `${t2('sistema', { system: sistema.name })}` : <><IonIcon icon={returnDownForward} /> {t2('sistema', { system: sistema.name })} {sistema.date && <IonNote className='oc-results-sistemas--item-note'>{sistema.date}</IonNote>}</>
                return <div key={sistema.id} className='oc-results-sistemas--item' style={{ paddingInlineStart: `calc(var(--oc-results-sistemas--item-padding) * ${i})` }}>{sistemaName}</div>
              })
            }
          </AccordionDetails>
        </Accordion>
      </>
    )
  }

  return (
    <IonItem className='oc-results-sistemas'>
      <IonLabel>{t2('sistema', { system: sistemaHistory[0].name })}</IonLabel>
      <SvgIcon component={CaveSystemIcon} inheritViewBox slot='start' className='cave-system-icon' htmlColor={currentSistema.color ?? 'red'} />
    </IonItem>
  )
}