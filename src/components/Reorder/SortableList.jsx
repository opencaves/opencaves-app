import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, useTheme } from '@mui/material'
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Loaded only for editors, with the list it sorts (Reorderable.jsx): dnd-kit
// stays out of the other bundles.

// The whole item is dragged, and still opens on a click or a tap: a mouse
// drag starts once the pointer has moved a few pixels (a click doesn't
// move), a touch one after a short press held still (a tap is shorter, a
// swipe moves first and scrolls).
const MOUSE_DISTANCE = 6
const TOUCH_DELAY = 200
const TOUCH_TOLERANCE = 5

// The status said to screen readers: out of sight, and out of the layout
// (fixed: an absolute one, placed after the list, made the pane around it
// overflow - a second scrollbar, and a horizontal one).
const visuallyHidden = { position: 'fixed', top: 0, left: 0, width: 1, height: 1, p: 0, m: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: 0 }

// A drag ends with the button released over the item (dropped, or after
// Escape cancelled it), which the browser then clicks: that click is
// swallowed (the item would open) - from the drag's start until just after
// the button or the finger is released.
function swallowClicksUntilRelease() {
  const swallow = (event) => {
    event.preventDefault()
    event.stopPropagation()
  }
  const release = () => {
    window.removeEventListener('mouseup', release, true)
    window.removeEventListener('touchend', release, true)
    window.removeEventListener('touchcancel', release, true)
    // After the click that follows the release, in the same task.
    setTimeout(() => window.removeEventListener('click', swallow, true))
  }
  window.addEventListener('click', swallow, true)
  window.addEventListener('mouseup', release, true)
  window.addEventListener('touchend', release, true)
  window.addEventListener('touchcancel', release, true)
}

/**
 * One item of a {@link SortableList}: its sortable state handed to the
 * list's renderItem - the props for its root (`itemProps`). Its link or
 * button (the item's first) is described by the list's instructions. The
 * props a TransitionGroup gives its children (`in`, `onExited`...) go along
 * as `transitionProps`.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {number} props.index
 * @param {boolean} props.dropDisabled - Not a place the item dragged can go (another group's).
 * @param {SortableRenderItem} props.render
 * @param {string} props.describedBy - The instructions' id.
 * @param {(id: string, event: React.KeyboardEvent) => void} props.onMoveKey - A key pressed on the item.
 * @param {(id: string, node: HTMLElement | null) => void} props.register - Its root, for the keyboard moves.
 */
function SortableItem({ id, index, dropDisabled, render, describedBy, onMoveKey, register, ...transitionProps }) {
  const { sys } = useTheme()
  const nodeRef = useRef(null)
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: { draggable: false, droppable: dropDisabled },
    // The other items making room: MD3's standard motion.
    transition: { duration: sys.motion.duration.standard, easing: sys.motion.easing.standard },
  })

  // Its link or button told how to move it (the keyboard's way).
  useEffect(() => {
    const node = nodeRef.current
    const target = node?.matches('a, button') ? node : node?.querySelector('a, button')
    if (!target) return undefined
    target.setAttribute('aria-describedby', describedBy)
    return () => target.removeAttribute('aria-describedby')
  }, [describedBy])

  const ref = useCallback(
    (node) => {
      nodeRef.current = node
      setNodeRef(node)
      register(id, node)
    },
    [id, setNodeRef, register],
  )
  const itemProps = {
    ref,
    style: {
      transform: CSS.Translate.toString(transform),
      transition,
      position: /** @type {const} */ ('relative'),
      zIndex: isDragging ? 2 : undefined,
      cursor: isDragging ? 'grabbing' : 'grab',
      // A link or a picture would start the browser's own drag (a ghost
      // image) or, held on a phone, its menu.
      WebkitUserDrag: /** @type {const} */ ('none'),
      WebkitTouchCallout: /** @type {const} */ ('none'),
      userSelect: /** @type {const} */ ('none'),
    },
    ...listeners,
    onKeyDown: (event) => onMoveKey(id, event),
    onContextMenu: (event) => isDragging && event.preventDefault(),
    onDragStart: (event) => event.preventDefault(),
  }
  return render(id, index, { itemProps, isDragging, transitionProps })
}
const MemoSortableItem = memo(SortableItem)

/**
 * A list its editors reorder by drag and drop (dnd-kit): the whole item is
 * dragged - with a mouse once it moves a few pixels, by touch after a short
 * press - and still opens on a click or a tap (the click ending a drag is
 * swallowed). With the keyboard, the focused item moves with Ctrl+Shift
 * (Cmd+Shift on a Mac) and an arrow key: no lifted state, so Enter and
 * Space keep their usual meaning on the item's link or button. Each move is
 * said to screen readers, and the items' links are described by these
 * instructions. With `groupOf`, an item only moves among its own group's
 * (a cave's maps: each system's). Loaded on demand through Reorderable.jsx.
 *
 * @param {object} props
 * @param {string[]} props.ids - The items, in their order (unique).
 * @param {(ids: string[], move: {from: number, to: number}) => void} props.onReorder - The new order, on a drop or a
 *   keyboard move that moved an item.
 * @param {SortableRenderItem} props.renderItem - Draws an item (its root keyed by the id, with the sortable's itemProps).
 * @param {(items: React.ReactNode[]) => React.ReactNode} [props.wrap] - Puts the items in their container (a list, a TransitionGroup).
 * @param {(id: string) => string} [props.groupOf] - An item's group, which it can't leave.
 * @param {'grid' | 'vertical'} [props.strategy='grid'] - The items' layout: a grid (Up and Down move a row) or a column.
 */
export default function SortableList({ ids, onReorder, renderItem, wrap = (items) => items, groupOf, strategy = 'grid' }) {
  const { t } = useTranslation('reorder')
  const instructionsId = `oc-sortable-instructions-${useId().replace(/:/g, '')}`
  const [activeId, setActiveId] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  const nodes = useRef(new Map())
  const refocus = useRef(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: MOUSE_DISTANCE } }),
    useSensor(TouchSensor, { activationConstraint: { delay: TOUCH_DELAY, tolerance: TOUCH_TOLERANCE } }),
  )
  const count = ids.length
  const position = (id) => ids.indexOf(String(id)) + 1
  // Said to screen readers as a pointer drags an item.
  const accessibility = useMemo(
    () => ({
      screenReaderInstructions: { draggable: t('instructions') },
      announcements: {
        onDragStart: ({ active }) => t('pickedUp', { position: position(active.id), count }),
        onDragOver: ({ over }) => (over ? t('movedTo', { position: position(over.id), count }) : t('notOver')),
        onDragEnd: ({ active, over }) => (over ? t('dropped', { position: position(over.id), count }) : t('cancelled', { position: position(active.id), count })),
        onDragCancel: ({ active }) => t('cancelled', { position: position(active.id), count }),
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, ids],
  )
  const activeGroup = activeId != null && groupOf ? groupOf(activeId) : null

  // Escape while dragging cancels the drag only: a dialog around the list
  // (Show all) would take it first, close, and keep it from dnd-kit's
  // listener (on the document) - so it's caught first and handed to that
  // listener alone.
  useEffect(() => {
    if (activeId == null) return undefined
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || !event.isTrusted) return
      event.stopPropagation()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }))
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [activeId])

  // A keyboard move keeps the focus on the item moved.
  useEffect(() => {
    const id = refocus.current
    if (!id) return
    refocus.current = null
    const node = nodes.current.get(id)
    const target = node?.matches('a, button') ? node : node?.querySelector('a, button')
    if (target && document.activeElement !== target) target.focus()
  }, [ids])

  const register = useCallback((id, node) => {
    if (node) nodes.current.set(id, node)
    else nodes.current.delete(id)
  }, [])

  // Up and Down in a grid: a row (the items as high as the first one).
  function columns() {
    if (strategy === 'vertical') return 1
    const tops = ids.map((id) => nodes.current.get(id)?.getBoundingClientRect().top)
    const row = tops.filter((top) => top != null && Math.abs(top - tops[0]) < 1).length
    return Math.max(1, row)
  }

  // Ctrl+Shift (Cmd+Shift) and an arrow: the focused item one place earlier
  // or later (a row up or down in a grid), within its group.
  function moveKey(id, event) {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey) return
    const node = nodes.current.get(id)
    const rtl = node && getComputedStyle(node).direction === 'rtl'
    const step = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, ArrowUp: -columns(), ArrowDown: columns() }[event.key]
    if (!step) return
    event.preventDefault()
    event.stopPropagation()
    const from = ids.indexOf(id)
    const group = groupOf ? groupOf(id) : null
    const inGroup = ids.map((other, index) => (groupOf && groupOf(other) !== group ? -1 : index)).filter((index) => index >= 0)
    const to = Math.min(Math.max(from + step, inGroup[0]), inGroup[inGroup.length - 1])
    if (to === from) return
    refocus.current = id
    onReorder(arrayMove(ids, from, to), { from, to })
    setAnnouncement(t('movedTo', { position: to + 1, count }))
  }

  // One handler for every render (the items are memoized: a drag starting
  // re-renders only what dnd-kit's own state changes), calling this render's.
  const moveKeyRef = useRef(moveKey)
  moveKeyRef.current = moveKey
  const onMoveKey = useCallback((id, event) => moveKeyRef.current(id, event), [])

  function onDragEnd({ active, over }) {
    setActiveId(null)
    if (!over || active.id === over.id) return
    if (groupOf && groupOf(String(active.id)) !== groupOf(String(over.id))) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    onReorder(arrayMove(ids, from, to), { from, to })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={accessibility}
      onDragStart={({ active }) => {
        setActiveId(String(active.id))
        swallowClicksUntilRelease()
      }}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={strategy === 'vertical' ? verticalListSortingStrategy : rectSortingStrategy}>
        {wrap(ids.map((id, index) => <MemoSortableItem key={id} id={id} index={index} dropDisabled={activeGroup != null && groupOf(id) !== activeGroup} render={renderItem} describedBy={instructionsId} onMoveKey={onMoveKey} register={register} />))}
      </SortableContext>
      {/* Read through aria-describedby, which reads hidden text too. */}
      <span id={instructionsId} className="oc-sortable-list--instructions" hidden>
        {t('instructions')}
      </span>
      <Box component="span" role="status" aria-live="polite" className="oc-sortable-list--status" sx={visuallyHidden}>
        {announcement}
      </Box>
    </DndContext>
  )
}
