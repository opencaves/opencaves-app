import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { SvgIcon } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { styled } from '@mui/material'
import { HelpOutlineRounded } from '@mui/icons-material'
import Markdown from '../Markdown/Markdown'
import { ReactComponent as KeyIcon } from '@/images/accesses/key.svg'
import { ReactComponent as NoIcon } from '@/images/accesses/no.svg'
import { ReactComponent as YesIcon } from '@/images/accesses/yes.svg'
import { ReactComponent as PermissionIcon } from '@/images/accesses/permission.svg'
import { ReactComponent as CustomersIcon } from '@/images/accesses/customers.svg'
import { ReactComponent as UnknownIcon } from '@/images/accesses/unknown.svg'
import { ReactComponent as SidemountIcon } from '@/images/accessibilities/sidemount.svg'
import { ReactComponent as SeaIcon } from '@/images/accessibilities/sea.svg'
import { ReactComponent as NotSafeIcon } from '@/images/accessibilities/not-safe.svg'
import { ReactComponent as InaccessibleIcon } from '@/images/accessibilities/inaccessible.svg'
import { ReactComponent as JungleIcon } from '@/images/accessibilities/jungle.svg'
import { ReactComponent as VariableIcon } from '@/images/accessibilities/variable.svg'
import { ReactComponent as FeesYesIcon } from '@/images/fees/fees-yes.svg'
import { ReactComponent as FeesNoIcon } from '@/images/fees/fees-no.svg'
import './Access.scss'


export default function Access({ cave }) {

  const { t } = useTranslation(['resultPane', 'accesses', 'accessibilities'])
  const accesses = useSelector(state => state.data.accesses)
  const accessibilities = useSelector(state => state.data.accessibilities)

  function getAccessIcon() {
    const access = accesses.find(a => a.id === cave.access) || { name: 'unknown' }
    let icon
    switch (access.name) {
      case 'key':
        icon = KeyIcon
        break
      case 'yes':
        icon = YesIcon
        break
      case 'no':
        icon = NoIcon
        break
      case 'permission':
        icon = PermissionIcon
        break
      case 'customers':
        icon = CustomersIcon
        break
      default:
        icon = UnknownIcon
    }

    return <SvgIcon component={icon} fontSize='large' inheritViewBox aria-label={t(`${access.name}.label`, { ns: 'accesses' })} color='primary' className='oc-icon' />
  }

  function getAccessibilityIcon() {
    const accessibility = accessibilities.find(a => a.id === cave.accessibility) || { name: '_' }
    let icon
    switch (accessibility.id) {
      case 'jungle':
        icon = JungleIcon
        break
      case 'not-safe':
        icon = NotSafeIcon
        break
      case 'sidemount-only':
        icon = SidemountIcon
        break
      case 'variable':
        icon = VariableIcon
        break
      case 'inaccessible':
        icon = InaccessibleIcon
        break
      case 'sea':
        icon = SeaIcon
        break
      default:
        icon = HelpOutlineRounded
    }

    return <SvgIcon component={icon} fontSize='large' inheritViewBox aria-label={t(`${accessibility.name}.label`, { ns: 'accessibilities' })} color='primary' className='oc-icon' />
  }

  function getFeesIcon() {
    return <SvgIcon component={cave.fees ? FeesYesIcon : FeesNoIcon} fontSize='large' inheritViewBox aria-label={t(`${cave.fees ? 'yes' : 'no'}.label`, { ns: 'fees' })} color='primary' className='oc-icon' />
  }

  function getFeesLabel() {
    return cave.fees ? t('yes.label', { ns: 'fees' }) : t('no.label', { ns: 'fees' })
  }

  function getAccessLabel() {
    return Reflect.has(cave, 'access') ? t(`${cave.access}.label`, { ns: 'accesses' }) : t('unknown.label', { ns: 'accesses' })
  }

  function getAccessibilityLabel() {
    return Reflect.has(cave, 'accessibility') ? t(`${cave.accessibility}.label`, { ns: 'accessibilities' }) : t('unknown.label', { ns: 'accessibilities' })
  }

  const IconText = styled('span')(({ theme }) => ({
    // backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
    // ...theme.typography.body2,
    // padding: theme.spacing(1),
    // textAlign: 'center',
    color: theme.palette.primary.main,
  }))

  return (
    <>
      <div className='details-container'>
        <h2 className='h2'>{t('accessHeader')}</h2>
      </div>

      <div className='details-container'>
        <Grid container spacing={0} xs='auto' display="flex" justifyContent="center" alignItems="center">
          <div className='oc-access--grid'>
            <Grid xs='auto' display="flex" justifyContent="center" alignItems="center">
              <Grid container direction='column' spacing={1}>
                <Grid xs='auto' display='flex' justifyContent="center">
                  {
                    getAccessIcon()
                  }
                </Grid>
                <Grid xs='auto'>
                  <IconText className='oc-access--icon-text'>
                    {
                      getAccessLabel()
                    }
                  </IconText>
                </Grid>
              </Grid>
            </Grid>
            {
              cave.accessibility &&
              <Grid display="flex" justifyContent="center" alignItems="center">
                <Grid container direction='column' spacing={1}>
                  <Grid xs='auto' display='flex' justifyContent="center">
                    {
                      getAccessibilityIcon()
                    }
                  </Grid>
                  <Grid xs='auto'>
                    <IconText className='oc-access--icon-text'>
                      {
                        getAccessibilityLabel()
                      }
                    </IconText>
                  </Grid>
                </Grid>
              </Grid>
            }
            {
              Reflect.has(cave, 'fees') && cave.fees &&
              <Grid display="flex" justifyContent="center" alignItems="center">
                <Grid container direction='column' spacing={1}>
                  <Grid xs='auto' display='flex' justifyContent="center">
                    {
                      getFeesIcon()
                    }
                  </Grid>
                  <Grid xs='auto'>
                    <IconText className='oc-access--icon-text'>
                      {
                        getFeesLabel()
                      }
                    </IconText>
                  </Grid>
                </Grid>
              </Grid>
            }
          </div>
        </Grid>
      </div>

      {
        (cave.accessDetails || cave.accessibilityDetails) &&
        <div className='details-container details-text'>
          <Markdown>{cave.accessDetails}</Markdown>
          <Markdown>{cave.accessibilityDetails}</Markdown>
        </div>
      }
    </>
  )
}