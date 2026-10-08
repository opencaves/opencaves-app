import { useTranslation } from 'react-i18next'
import SourceSelect from '@/components/SourceSelect.jsx'

// Under a Markdown field in an edit form: where its words come from (the
// record's textSources entry for it). value: { source }. Only under a
// text with words (the forms leave it out otherwise). Its hint: edited
// words are the app's (withTextChange sets Open Caves).
export default function TextSourceField({ value, onChange, sources }) {
  const { t } = useTranslation('textSource')
  return <SourceSelect dense className="oc-text-source-field" label={t('fieldLabel')} helperText={t('fieldHint')} noneLabel={t('none')} sources={sources} value={value?.source || ''} onChange={(source) => onChange({ source })} />
}
