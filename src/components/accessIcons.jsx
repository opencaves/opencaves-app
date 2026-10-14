import { SvgIcon } from '@mui/material'
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded'
import EmojiPeopleRounded from '@mui/icons-material/EmojiPeopleRounded'
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
import FeesYesIcon from '@/images/fees/fees-yes.svg?react'
import FeesNoIcon from '@/images/fees/fees-no.svg?react'

// A guide (no drawing of its own): a person waving, Material's.
const GuideIcon = (props) => <EmojiPeopleRounded {...props} />

// Each access (the `accesses` table's keys), accessibility (the
// `accessibilities` table's) and fees (yes, no) by its icon: the cave's
// Access card, the What changed? menu (CaveReportMenu), the feedback page's
// proposed change.
const ICONS = {
  accesses: { yes: YesIcon, no: NoIcon, permission: PermissionIcon, key: KeyIcon, customers: CustomersIcon, guide: GuideIcon },
  accessibilities: { jungle: JungleIcon, 'not-safe': NotSafeIcon, 'sidemount-only': SidemountIcon, variable: VariableIcon, inaccessible: InaccessibleIcon, sea: SeaIcon },
  fees: { yes: FeesYesIcon, no: FeesNoIcon },
}
const FALLBACK = { accesses: UnknownIcon, accessibilities: HelpOutlineRounded, fees: HelpOutlineRounded }

/**
 * An access's, an accessibility's or the fees' icon, by its key in its
 * table (an unknown or missing one: the table's "unknown" icon).
 *
 * `value` is its key (a cave's `access` or `accessibility`); `fontSize` puts
 * it in an SvgIcon box (menus) - none: the drawing as it is (the Access
 * card's own size).
 *
 * @param {{ table: 'accesses'|'accessibilities'|'fees', value?: string, className?: string, 'aria-label'?: string, fontSize?: import('@mui/material').SvgIconProps['fontSize'] }} props
 */
export default function AccessIcon({ table, value, fontSize, ...props }) {
  const Icon = ICONS[table]?.[value] || FALLBACK[table] || UnknownIcon
  if (!fontSize) return <Icon {...props} />
  return <SvgIcon component={Icon} inheritViewBox fontSize={fontSize} {...props} />
}
