import { ListItemIcon, ListItemText, MenuItem } from '@mui/material'
import { SITE_URL } from '@/config/app.js'
import noop from '@/utils/noop.js'
import { downloadName, useMediaActionsFor } from './mediaActions.jsx'

/**
 * Media actions ({@link useMediaActionsFor}'s) as a MUI Menu's items - each
 * keyed, no Fragment (a Menu takes none among its children).
 *
 * @param {import('./mediaActions.jsx').MediaAction[]} actions
 * @returns {import('react').ReactElement[]}
 */
export function mediaMenuItems(actions) {
  return actions.map((action) => (
    <MenuItem key={action.key} className={`oc-media-action--${action.key}`} onClick={action.onClick} divider={action.divider}>
      <ListItemIcon>{action.icon}</ListItemIcon>
      <ListItemText>{action.label}</ListItemText>
    </MenuItem>
  ))
}

/**
 * A photo's items for everyone in its ⋮ menus (the cave page's strip and
 * Show all: PhotoItemMenu; the gallery viewer: MediaPaneMenu): Share (its
 * address, the cave's page with the photo open), Download (at full size) and
 * Report this photo ({@link useMediaActionsFor}) - in the viewer, Report only:
 * its toolbar has Share and Download buttons already.
 *
 * @param {import('@/models/CaveAsset.js').default} mediaAsset - The photo.
 * @param {object} [options]
 * @param {() => void} [options.onDone] - Called as an item is chosen (closes the menu).
 * @param {boolean} [options.inViewer=false] - In the gallery viewer (its own Share and Download buttons).
 * @returns {import('react').ReactElement[]}
 */
export function usePhotoActionItems(mediaAsset, { onDone = noop, inViewer = false } = {}) {
  const path = `/caves/${mediaAsset.caveId}/photos/${mediaAsset.id}`
  const actions = useMediaActionsFor()({
    kind: 'photo',
    shareUrl: inViewer ? undefined : `${SITE_URL}${path}`,
    download: inViewer ? undefined : { url: mediaAsset.url, fileName: downloadName('opencaves', mediaAsset.id, mediaAsset.mediaType) },
    reportPage: path,
    onDone,
  })
  return mediaMenuItems(actions)
}
