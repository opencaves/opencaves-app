import { IonList, IonItem, IonLabel, IonGrid, IonRow, IonCol } from '@ionic/react'
import { useTranslation } from 'react-i18next'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import DoNotDisturbRoundedIcon from '@mui/icons-material/DoNotDisturbRounded'
import Markdown from '../Markdown/Markdown'
import { ReactComponent as KeyIcon } from '../../images/accesses/key.svg'
import { ReactComponent as NoIcon } from '../../images/accesses/no.svg'
import { ReactComponent as YesIcon } from '../../images/accesses/yes.svg'
import { ReactComponent as PermissionIcon } from '../../images/accesses/permission.svg'
import { ReactComponent as CustomersIcon } from '../../images/accesses/customers.svg'
import { ReactComponent as UnknownIcon } from '../../images/accesses/unknown.svg'
import { ReactComponent as SidemountIcon } from '../../images/accessibilities/sidemount.svg'
import { ReactComponent as SeaIcon } from '../../images/accessibilities/sea.svg'
import { ReactComponent as NotSafeIcon } from '../../images/accessibilities/not-safe.svg'
import { ReactComponent as InaccessibleIcon } from '../../images/accessibilities/inaccessible.svg'
import { ReactComponent as JungleIcon } from '../../images/accessibilities/jungle.svg'
import { ReactComponent as VariableIcon } from '../../images/accessibilities/variable.svg'
import './CurrentCaveDetails.scss'
import { useSelector } from 'react-redux'
import './Access.scss'


export default function Access({ cave }) {

  const { t } = useTranslation(['resultPane', 'accesses', 'accessibilities'])
  const accesses = useSelector(state => state.data.accesses)
  const accessibilities = useSelector(state => state.data.accessibilities)

  function getAccess(accessId) {
    const access = accesses.find(a => a.id === accessId) || { name: 'unknown' }
    let icon
    switch (access.name) {
      case 'key':
        icon = <KeyIcon className='oc-icon' aria-label={t('key.label', { ns: 'accesses' })} />
        break
      case 'yes':
        icon = <YesIcon className='oc-icon' aria-label={t('yes.label', { ns: 'accesses' })} />
        break
      case 'no':
        icon = <NoIcon className='oc-icon' role='image' aria-label={t('no.label', { ns: 'accesses' })} />
        break
      case 'permission':
        icon = <PermissionIcon className='oc-icon' aria-label={t('permission.label', { ns: 'accesses' })} />
        break
      case 'customers':
        icon = <CustomersIcon className='oc-icon' aria-label={t('customers.label', { ns: 'accesses' })} />
        break
      default:
        icon = <UnknownIcon className='oc-icon' aria-label={t('unknown.label', { ns: 'accesses' })} />
    }

    return <div className='oc-access-grid'>
      <div>{icon}</div>
      <div className='oc-access-grid--label'>{t(`${access.name}.label`, { ns: 'accesses' })}</div>
    </div>
  }

  function getAccessibility(accessibilityId) {
    const accessibility = accessibilities.find(a => a.id === accessibilityId) || { name: '_' }
    let icon
    switch (accessibility.id) {
      case 'jungle':
        icon = <JungleIcon className='oc-icon' aria-label={t('jungle.label', { ns: 'accessibilities' })} />
        break
      case 'not-safe':
        icon = <NotSafeIcon className='oc-icon' aria-label={t('not safe.label', { ns: 'accessibilities' })} />
        break
      case 'sidemount-only':
        icon = <SidemountIcon className='oc-icon' aria-label={t('sidemount-only.label', { ns: 'accessibilities' })} />
        break
      case 'variable':
        icon = <VariableIcon className='oc-icon' aria-label={t('variable.label', { ns: 'accessibilities' })} />
        break
      case 'inaccessible':
        icon = <InaccessibleIcon className='oc-icon' aria-label={t('inaccessible.label', { ns: 'accessibilities' })} />
        break
      case 'sea':
        icon = <SeaIcon className='oc-icon' aria-label={t('sea.label', { ns: 'accessibilities' })} />
        break
      default:
        icon = <HelpOutlineRoundedIcon className='oc-icon' aria-label={t('sidemount-only.label', { ns: 'accessibilities' })} />
    }
    return <div className='oc-access-grid'>
      <div>{icon}</div>
      <div className='oc-access-grid--label'>{t(`${accessibility.id}.label`, { ns: 'accessibilities' })}</div>
    </div>
  }

  function getAccessDetailsDefault(accessId) {
    return accessId ? t(`${accessId}.description`, { ns: 'accesses' }) : t('unknown.description', { ns: 'accesses' })
  }

  function getAccessibilityDetailsDefault(accessibilityId) {
    return t(`${accessibilityId}.description`, { ns: 'accessibilities' })
  }

  return (
    <>
      <div className='details-container'>
        <h2>{t('accessHeader')}</h2>
      </div>

      <IonGrid className='oc-accesses-grid'>
        <IonRow className='ion-justify-content-center'>
          <IonCol size='auto'>
            {getAccess(cave.access)}
          </IonCol>
          {
            cave.accessibility &&
            <IonCol size='auto'>
              {getAccessibility(cave.accessibility)}
            </IonCol>
          }
        </IonRow>
      </IonGrid >

      <div className='details-container'>
        {
          Reflect.has(cave, 'accessDetails') &&
          <Markdown>{cave.accessDetails}</Markdown>
        }
        {
          !Reflect.has(cave, 'accessDetails') &&
          <Markdown>{getAccessDetailsDefault(cave.access)}</Markdown>
        }
        {
          Reflect.has(cave, 'accessibilityDetails') &&
          <Markdown>{cave.accessibilityDetails}</Markdown>
        }
        {
          Reflect.has(cave, 'accessibility') && !Reflect.has(cave, 'accessibilityDetails') &&
          <Markdown>{getAccessibilityDetailsDefault(cave.accessibility)}</Markdown>
        }
      </div>

      {/* <hr />

      <IonList lines='none'>
        <IonItem>
          {
            getAccessIcon(cave.access)
          }
          <IonLabel className='ion-text-wrap'><Markdown>{accessDetails}</Markdown></IonLabel>
        </IonItem>
      </IonList> */}
    </>
  )
}