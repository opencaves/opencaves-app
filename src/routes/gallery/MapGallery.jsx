import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import mapsModel from '@/models/MapModel.js'
import SistemaModel from '@/models/SistemaModel.js'
import ConnectionModel from '@/models/ConnectionModel.js'
import { compareMapsByDate, getSistemaMapRefs } from '@/utils/sistemaMaps.js'
import { isTrashed } from '@/utils/trash.js'
import MapPaneDetails from '@/components/MapPane/MapPaneDetails.jsx'
import { useCanTrashMaps, useTrashMapConfirm } from '@/components/MapPane/TrashMap.jsx'
import GalleryOverlay from './GalleryOverlay.jsx'

/**
 * /caves/:caveId/maps/:mapId, /sistemas/:sistemaId/maps/:mapId - a system's
 * maps (its own and those of the systems it joined, as its page's Maps
 * section), over the page that opened it, which hands over the system and
 * the data (Outlet context). The map's viewer, with its tools: Edit
 * (editors, /edit), the trash (admins). Only these maps; the arrow or
 * Escape lead back to the page.
 */
export default function MapGallery() {
  const { mapId } = useParams()
  // The page's systems and connections, or (the cave's edit page, which has
  // none) the live ones.
  const context = useOutletContext()
  const [liveSistemas] = SistemaModel.useAll()
  const [liveConnections] = ConnectionModel.useAll()
  const { sistemaId } = context
  const sistemas = context.sistemas || liveSistemas
  const connections = context.connections || liveConnections
  const navigate = useNavigate()
  const location = useLocation()
  const isEditor = useSelector((/** @type {RootState} */ state) => state.session.roles).includes('editor')
  const canTrash = useCanTrashMaps()
  // With the trashed ones: one trashed while open leaves the list.
  const [mapFiles, loading] = mapsModel.useAll({ includeTrashed: true })
  const maps = getSistemaMapRefs(sistemaId, sistemas, connections)
    .map(({ id, sistemaId: ownerId }) => {
      const map = mapFiles.find((m) => m.id === id)
      return map && !isTrashed(map) && { ...map, sistemaId: ownerId }
    })
    .filter(Boolean)
    // As the page's list: newest first, the undated last.
    .sort(compareMapsByDate)
  // The page's address, whatever follows (a map, its /edit).
  const pagePath = location.pathname.replace(/\/maps\/.*$/, '')
  const mapPath = (id) => `${pagePath}/maps/${id}`
  // Opened from the page (fromPage): a step back to it, so Back doesn't
  // reopen the gallery; from a link, to the page.
  const close = () => (location.state?.fromPage ? navigate(-1) : navigate(pagePath))

  useEffect(() => {
    if (!loading && maps.length === 0) navigate(pagePath, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, maps.length])

  const { requestTrash, dialog: trashDialog } = useTrashMapConfirm({
    onAfterTrash: (map) => {
      const remaining = maps.filter((m) => m.id !== map.id)
      if (map.id === mapId && remaining.length > 0) navigate(mapPath(remaining[0].id), { replace: true, state: location.state })
    },
  })

  return (
    <GalleryOverlay className="oc-map-gallery" onClose={close} returnFocus={() => document.querySelector(`a[href$="/maps/${mapId}"]`)}>
      {maps.length > 0 && <MapPaneDetails mapId={mapId} maps={maps} sistemaId={sistemaId} returnTo={pagePath} mapPath={mapPath} onTrash={canTrash ? requestTrash : undefined} canEdit={isEditor} alwaysShowBack onBack={close} captioned />}
      {/* /edit: the map's Edit dialog (routes/map/maps/MapEdit.jsx). */}
      <Outlet context={{ maps }} />
      {trashDialog}
    </GalleryOverlay>
  )
}
