import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'

const sourcesModel = createCollectionModel('sources')

// Under a text (a cave's or system's description, directions...): where its
// words come from - its record's textSources entry for that field ("Source:
// Gerrard 2015"). Nothing when it has none, and nothing for anyone but
// admins: an editing note, not part of the public page.
export default function TextSource({ record, field, sx }) {
  const { t } = useTranslation('textSource')
  const [sources] = sourcesModel.useAll()
  const isAdmin = useSelector((state) => state.session.roles).includes('admin')
  if (!isAdmin) return null
  const entry = record?.textSources?.[field]
  if (!entry?.source) return null
  const name = sources.find((source) => source.id === entry.source)?.name
  if (!name) return null
  return (
    <Typography className="oc-text-source" variant="caption" component="p" sx={[{ display: 'block', mt: 0.5, color: 'text.secondary' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {t('known', { name })}
    </Typography>
  )
}
