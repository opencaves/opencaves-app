import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTitle } from '@/hooks/useTitle.jsx'
import SistemaEditForm from '@/components/SistemaPane/SistemaEditForm.jsx'

export default function SistemaEdit() {
  const { sistemaId } = useParams()
  const navigate = useNavigate()
  const { setTitle } = useTitle()
  const [pageTitle, setPageTitle] = useState(sistemaId)

  useEffect(() => {
    setTitle(pageTitle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageTitle])

  return (
    <div className="oc-sistema-edit">
      <SistemaEditForm sistemaId={sistemaId} onTitleChange={setPageTitle} onDone={() => navigate('/sistemas')} />
    </div>
  )
}
