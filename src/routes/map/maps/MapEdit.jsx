import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import EditMapDialog from '@/components/MapsPicker/EditMapDialog.jsx'

// /map/:caveId/maps/:mapId/edit - the map's Edit dialog, over its viewer
// (MapPane, which hands over the cave's maps). Closing goes back where the
// person came from (the cave's Maps tab, or the viewer); opened from a link,
// to the map's viewer.
export default function MapEdit() {
  const { mapId } = useParams()
  const { maps = [] } = useOutletContext() || {}
  const navigate = useNavigate()
  const location = useLocation()
  const map = maps.find((m) => m.id === mapId) || null

  function close() {
    if (location.key !== 'default') navigate(-1)
    else navigate('..', { relative: 'path', replace: true })
  }

  return <EditMapDialog map={map} onClose={close} />
}
