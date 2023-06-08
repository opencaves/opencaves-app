
import { useTranslation } from 'react-i18next'
import { IonAccordionGroup, IonAccordion, IonItem, IonLabel, IonIcon, IonNote } from '@ionic/react'
import { returnDownForward } from 'ionicons/icons'
import { SvgIcon } from '@mui/material'
import { getSistemaById } from '../../models/Sistema.js'
import { ReactComponent as CaveSystemIcon } from '../../images/cave-system.svg'

export default function Sistema({ sistemaHistory }) {

  const { t } = useTranslation('resultPane')

  const hasSistemaAncestry = sistemaHistory.length > 1
  const currentSistema = getSistemaById(sistemaHistory.at(-1).id)

  if (hasSistemaAncestry) {
    return (
      <IonAccordionGroup className='oc-results-sistemas'>
        <IonAccordion>
          <IonItem slot='header'>
            <IonLabel>{t('sistema', { system: currentSistema.name })}</IonLabel>
            {/* <CaveSystemIcon slot='start' className='cave-system-icon' sx={{ color: currentSistema.color }} /> */}
            <SvgIcon component={CaveSystemIcon} inheritViewBox slot='start' className='cave-system-icon' htmlColor={currentSistema.color ?? 'red'} />
          </IonItem>
          <IonItem slot='content' className='oc-results-sistemas--sistemas' color='light'>
            <div>
              {
                sistemaHistory.map((sistema, i) => {
                  const sistemaName = i === 0 ? `${t('sistema', { system: sistema.name })}` : <><IonIcon icon={returnDownForward} /> {t('sistema', { system: sistema.name })} {sistema.date && <IonNote className='oc-results-sistemas--item-note'>{sistema.date}</IonNote>}</>
                  return <div key={sistema.id} className='oc-results-sistemas--item' style={{ paddingInlineStart: `calc(var(--oc-results-sistemas--item-padding) * ${i})` }}>{sistemaName}</div>
                })
              }
            </div>
          </IonItem>
        </IonAccordion>
      </IonAccordionGroup>
    )
  }

  return (
    <IonItem className='oc-results-sistemas'>
      <IonLabel>{t('sistema', { system: sistemaHistory[0].name })}</IonLabel>
      <SvgIcon component={CaveSystemIcon} inheritViewBox slot='start' className='cave-system-icon' htmlColor={currentSistema.color ?? 'red'} />
    </IonItem>
  )
}