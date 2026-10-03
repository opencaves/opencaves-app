import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import EditMapDialog from '@/components/MapsPicker/EditMapDialog.jsx'

// /map/:caveId/maps/:mapId/edit - the map's Edit dialog, over its viewer
// (MapPane, which hands over the cave's maps). Closing it (Cancel, x, Save)
// only drops /edit: the viewer stays. Replaced, so Back from the viewer still
// goes where the person came from.
export default function MapEdit() {
  const { mapId } = useParams()
  const { maps = [] } = useOutletContext() || {}
  const navigate = useNavigate()
  const location = useLocation()
  const map = maps.find((m) => m.id === mapId) || null

  function close() {
    navigate('..', { relative: 'path', replace: true, state: location.state })
  }

  return <EditMapDialog map={map} onClose={close} />
}
