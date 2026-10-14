import { Suspense, lazy } from 'react'
import { useTranslation } from 'react-i18next'
import { Box } from '@mui/material'

/**
 * The items drawn plain, not sortable (renderItem given no sortable).
 *
 * @param {object} props
 * @param {string[]} props.ids
 * @param {SortableRenderItem} props.renderItem
 * @param {(items: React.ReactNode[]) => React.ReactNode} [props.wrap]
 */
function PlainList({ ids, renderItem, wrap = (items) => items }) {
  return <>{wrap(ids.map((id, index) => renderItem(id, index, null)))}</>
}

// dnd-kit and the drag handles, loaded only once an editor's list is shown;
// failing to load (offline, a new version deployed), the list stays as it is.
const SortableList = lazy(() =>
  import('./SortableList.jsx').catch((error) => {
    console.error(error)
    // Takes SortableList's props, using the ones it needs.
    return { default: /** @type {typeof import('./SortableList.jsx').default} */ (PlainList) }
  }),
)

/**
 * A list editors reorder by drag and drop, the others see as it is: with
 * `enabled`, a {@link SortableList} (loaded on demand: until then, and
 * without `enabled`, the items drawn plain, renderItem given no sortable).
 *
 * @param {object} props
 * @param {boolean} props.enabled - Editors: sortable.
 * @param {string[]} props.ids - The items, in their order (unique).
 * @param {SortableRenderItem} props.renderItem - Draws an item.
 * @param {(ids: string[], move: {from: number, to: number}) => void} props.onReorder - The new order, on a drop.
 * @param {(items: React.ReactNode[]) => React.ReactNode} [props.wrap] - Puts the items in their container.
 * @param {(id: string) => string} [props.groupOf] - An item's group, which it can't leave.
 * @param {'grid' | 'vertical'} [props.strategy='grid'] - The items' layout.
 */
export default function Reorderable({ enabled, ids, renderItem, onReorder, wrap = (items) => items, groupOf, strategy = 'grid' }) {
  const plain = <PlainList ids={ids} renderItem={renderItem} wrap={wrap} />
  if (!enabled) return plain
  return (
    <Suspense fallback={plain}>
      <SortableList ids={ids} renderItem={renderItem} onReorder={onReorder} wrap={wrap} groupOf={groupOf} strategy={strategy} />
    </Suspense>
  )
}

/**
 * "Cover", on the first photo of a list editors reorder: the first photo is
 * the cave's cover, so moving one there makes it the cover. A small MD3
 * label (secondary container) over the photo's corner, its side set by `sx`.
 *
 * @param {object} props
 * @param {Sx} [props.sx]
 */
export function CoverBadge({ sx }) {
  const { t } = useTranslation('reorder')
  return (
    <Box
      component="span"
      className="oc-cover-badge"
      sx={[
        (theme) => ({
          position: 'absolute',
          zIndex: 1,
          px: 1,
          py: 0.25,
          borderRadius: 1,
          ...theme.typography.caption,
          fontWeight: 500,
          lineHeight: '20px',
          color: theme.vars.sys.color.onSecondaryContainer,
          bgcolor: theme.vars.sys.color.secondaryContainer,
          pointerEvents: 'none',
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {t('cover')}
    </Box>
  )
}
