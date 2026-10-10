import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import EditMapDialog from '@/components/MapsPicker/EditMapDialog.jsx'

/**
 * /map/:caveId/maps/:mapId/edit - the map's Edit dialog, over its viewer
 * (MapPane, which hands over the cave's maps; a page's MapGallery). Closing
 * it (Cancel, x, Save) only drops /edit: the viewer stays - a step back when
 * the viewer's menu opened it, so Back then leaves the viewer (the map isn't
 * twice in the history); otherwise replaced.
 */
export default function MapEdit() {
  const { mapId } = useParams()
  const { maps = [] } = useOutletContext() || {}
  const navigate = useNavigate()
  const location = useLocation()
  const map = maps.find((m) => m.id === mapId) || null

  function close() {
    if (location.state?.editFromViewer) navigate(-1)
    else navigate('..', { relative: 'path', replace: true, state: location.state })
  }

  return <EditMapDialog map={map} onClose={close} />
}
