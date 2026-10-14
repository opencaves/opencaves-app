import { useTranslation } from 'react-i18next'
import { useCaveData } from '@/hooks/useCaveData.js'
import { Box, Tooltip } from '@mui/material'
import { styled } from '@mui/material'
import Markdown from '../Markdown/Markdown.jsx'
import TextSource from '@/components/TextSource.jsx'
import SectionReview from '@/components/CaveReview/SectionReview.jsx'
import ScubaDivingIcon from '@mui/icons-material/ScubaDivingRounded'
import './Access.scss'
import AccessIcon from '@/components/accessIcons.jsx'

/**
 * A cave's access (its page, the map's pane): its access, accessibility,
 * whether it's a cenote entrance and its fees, each an icon over its label,
 * their details below - then, unless its page or pane shows them after its
 * card ({@link AccessReview}), how old the access is, and the fees when they
 * show ("Still right?", SectionReview).
 *
 * @param {object} props
 * @param {Cave} props.cave
 * @param {boolean} [props.review=true] - Its Still accurate groups at its end.
 */
export default function Access({ cave, review = true }) {
  const { t } = useTranslation(['resultPane', 'accesses', 'accessibilities'])
  const { accesses, accessibilities } = useCaveData()

  // An icon in its fixed-size box (the same size for every item).
  function iconBox(icon) {
    return <span className="oc-access--icon">{icon}</span>
  }

  function getAccessIcon() {
    const access = accesses.find((a) => a.id === cave.access) || { name: 'unknown' }
    return iconBox(<AccessIcon table="accesses" value={access.id} aria-label={t(`${access.name}.label`, { ns: 'accesses' })} className="oc-icon" />)
  }

  function getAccessibilityIcon() {
    const accessibility = accessibilities.find((a) => a.id === cave.accessibility) || { name: '_' }
    return iconBox(<AccessIcon table="accessibilities" value={accessibility.id} aria-label={t(`${accessibility.name}.label`, { ns: 'accessibilities' })} className="oc-icon" />)
  }

  function getFeesIcon() {
    return iconBox(<AccessIcon table="fees" value={cave.fees ? 'yes' : 'no'} aria-label={t(`${cave.fees ? 'yes' : 'no'}.label`, { ns: 'fees' })} className="oc-icon" />)
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

      {review && (
        // Its Still accurate under the access, a line above it (as the pane's other sections').
        <Box className="oc-access oc-access--review" sx={{ borderTop: 1, borderColor: 'divider', mx: 2, mt: 1, mb: 1, pt: 1.25 }}>
          <AccessReview cave={cave} />
        </Box>
      )}
    </>
  )
}

/**
 * The Access card's Still accurate (SectionReview): the access, and the fees
 * when they show, confirmed together - for a page or pane drawing it on the
 * card's foot.
 *
 * @param {object} props
 * @param {Cave} props.cave
 */
export function AccessReview({ cave }) {
  return (
    <>
      <SectionReview cave={cave} sections={cave.fees ? ['access', 'fees'] : ['access']} />
    </>
  )
}
