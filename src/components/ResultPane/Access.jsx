import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { Tooltip } from '@mui/material'
import { styled } from '@mui/material'
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded'
import Markdown from '../Markdown/Markdown.jsx'
import TextSource from '@/components/TextSource.jsx'
import KeyIcon from '@/images/accesses/key.svg?react'
import NoIcon from '@/images/accesses/no.svg?react'
import YesIcon from '@/images/accesses/yes.svg?react'
import PermissionIcon from '@/images/accesses/permission.svg?react'
import CustomersIcon from '@/images/accesses/customers.svg?react'
import UnknownIcon from '@/images/accesses/unknown.svg?react'
import SidemountIcon from '@/images/accessibilities/sidemount.svg?react'
import SeaIcon from '@/images/accessibilities/sea.svg?react'
import NotSafeIcon from '@/images/accessibilities/not-safe.svg?react'
import InaccessibleIcon from '@/images/accessibilities/inaccessible.svg?react'
import JungleIcon from '@/images/accessibilities/jungle.svg?react'
import VariableIcon from '@/images/accessibilities/variable.svg?react'
import ScubaDivingIcon from '@mui/icons-material/ScubaDiving'
import FeesYesIcon from '@/images/fees/fees-yes.svg?react'
import FeesNoIcon from '@/images/fees/fees-no.svg?react'
import './Access.scss'

export default function Access({ cave }) {
  const { t } = useTranslation(['resultPane', 'accesses', 'accessibilities'])
  const accesses = useSelector((state) => state.data.accesses)
  const accessibilities = useSelector((state) => state.data.accessibilities)

  // An icon in its fixed-size box (the same size for every item).
  function iconBox(icon) {
    return <span className="oc-access--icon">{icon}</span>
  }

  function getAccessIcon() {
    const access = accesses.find((a) => a.id === cave.access) || { name: 'unknown' }
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

    const Icon = icon
    return iconBox(<Icon aria-label={t(`${access.name}.label`, { ns: 'accesses' })} className="oc-icon" />)
  }

  function getAccessibilityIcon() {
    const accessibility = accessibilities.find((a) => a.id === cave.accessibility) || { name: '_' }
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

    const Icon = icon
    return iconBox(<Icon aria-label={t(`${accessibility.name}.label`, { ns: 'accessibilities' })} className="oc-icon" />)
  }

  function getFeesIcon() {
    const Icon = cave.fees ? FeesYesIcon : FeesNoIcon
    return iconBox(<Icon aria-label={t(`${cave.fees ? 'yes' : 'no'}.label`, { ns: 'fees' })} className="oc-icon" />)
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
    color: theme.vars.sys.color.primary,
  }))

  // Each item explains itself on hover or focus (icon and label alike): its
  // value's description.
  const access = accesses.find((a) => a.id === cave.access) || { name: 'unknown' }
  const accessibility = accessibilities.find((a) => a.id === cave.accessibility) || { name: '_' }
  const items = [
    { key: 'access', icon: getAccessIcon(), label: getAccessLabel(), tip: t(`${access.name}.description`, { ns: 'accesses' }) },
    ...(cave.accessibility ? [{ key: 'accessibility', icon: getAccessibilityIcon(), label: getAccessibilityLabel(), tip: t(`${accessibility.name}.description`, { ns: 'accessibilities' }) }] : []),
    ...(cave.cenoteEntrance ? [{ key: 'cenoteEntrance', icon: iconBox(<ScubaDivingIcon aria-hidden className="oc-icon" />), label: t('cenoteEntrance'), tip: t('cenoteEntranceDescription') }] : []),
    ...(cave.fees ? [{ key: 'fees', icon: getFeesIcon(), label: getFeesLabel(), tip: t(`${cave.fees ? 'yes' : 'no'}.description`, { ns: 'fees' }) }] : []),
  ]

  return (
    <>
      <div className="details-container oc-access">
        <h2 className="h2">{t('accessHeader')}</h2>
      </div>

      <div className="details-container oc-access">
        {/* One column per item, all built alike: the icons in boxes of the
            same size on one line, their labels on the line below. */}
        <div className="oc-access--grid">
          {items.map(({ key, icon, label, tip }) => (
            <Tooltip key={key} title={tip} describeChild>
              <div className="oc-access--item" tabIndex={0}>
                {icon}
                <IconText className="oc-access--icon-text">{label}</IconText>
              </div>
            </Tooltip>
          ))}
        </div>
      </div>

      {(cave.accessDetails || cave.accessibilityDetails) && (
        <div className="details-container details-text oc-access">
          <Markdown>{cave.accessDetails}</Markdown>
          <TextSource record={cave} field="accessDetails" />
          <Markdown>{cave.accessibilityDetails}</Markdown>
          <TextSource record={cave} field="accessibilityDetails" />
        </div>
      )}
    </>
  )
}
