import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTitle } from '@/hooks/useTitle.jsx'
import { useSistemaSlugs } from '@/hooks/useIndexData.jsx'
import SistemaEditForm from '@/components/SistemaPane/SistemaEditForm.jsx'
import FormSkeleton from '@/components/Skeletons/FormSkeleton.jsx'

// The system an address names: its slug (the public page's), or its id
// (older links, and a new system's push id). prev: the last one resolved -
// kept while its slug changes under it (renamed and saved), and for a new
// system's id until it's saved.
function resolveSistemaId(param, sistemas, slugs, prev) {
  if (prev && (param === prev.id || param === slugs.get(prev.id) || param === prev.param)) return prev.id
  if (sistemas.some((sistema) => sistema.id === param)) return param
  for (const [id, slug] of slugs) {
    if (slug === param) return id
  }
  return param
}

export default function SistemaEdit() {
  const { sistemaId: param } = useParams()
  const navigate = useNavigate()
  const { setTitle } = useTitle()
  const sistemas = useSelector((state) => state.data.sistemas)
  const dataLoading = useSelector((state) => state.data.dataLoadingState.state) === 'loading' && sistemas.length === 0
  const slugs = useSistemaSlugs()
  const resolvedRef = useRef(null)
  const sistemaId = dataLoading ? null : resolveSistemaId(param, sistemas, slugs, resolvedRef.current)
  const [pageTitle, setPageTitle] = useState(param)
  const slug = sistemaId ? slugs.get(sistemaId) : null

  useEffect(() => {
    if (sistemaId) resolvedRef.current = { id: sistemaId, param }
  }, [sistemaId, param])

  // The address follows the system's slug: an id (older link, a new system
  // once saved) or a former name (renamed) becomes its current slug.
  useEffect(() => {
    if (slug && param !== slug) navigate(`/sistemas/${slug}/edit`, { replace: true })
  }, [slug, param, navigate])

  useEffect(() => {
    setTitle(pageTitle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageTitle])

  if (!sistemaId) {
    return <FormSkeleton className="oc-sistema-edit" />
  }

  // Back to the system's public page; to the list of systems when it has
  // none (a new system not saved yet, one deleted, one not public).
  const done = () => navigate(slugs.get(sistemaId) ? `/sistemas/${slugs.get(sistemaId)}` : '/sistemas')

  return (
    <div className="oc-sistema-edit">
      <SistemaEditForm sistemaId={sistemaId} onTitleChange={setPageTitle} onDone={done} onDeleted={() => navigate('/sistemas')} showMapPreview />
    </div>
  )
}
