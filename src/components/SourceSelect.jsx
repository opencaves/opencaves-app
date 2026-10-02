import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuItem, TextField } from '@mui/material'
import AddRounded from '@mui/icons-material/AddRounded'
import NewSourceDialog from '@/components/NewSourceDialog.jsx'

// Not a real source id: picking it opens NewSourceDialog instead of
// becoming the value.
const ADD_SOURCE = '__add-source__'

// An edit form's Source picker (the `sources` collection), starting with an
// "Add a source" entry that creates one in place (NewSourceDialog) and
// selects it. onChange gets the chosen source id ('' for none).
export default function SourceSelect({ label, value, onChange, sources, noneLabel, helperText, className }) {
  const { t } = useTranslation('newSourceDialog')
  const [adding, setAdding] = useState(false)

  return (
    <>
      <TextField
        select
        className={`oc-source-select${className ? ` ${className}` : ''}`}
        label={label}
        helperText={helperText}
        fullWidth
        value={value}
        onChange={(event) => {
          if (event.target.value === ADD_SOURCE) setAdding(true)
          else onChange(event.target.value)
        }}
      >
        {/* A border, not a <Divider>: Select gives every child the option
            role, so a divider would read as a blank choice. */}
        <MenuItem value={ADD_SOURCE} sx={{ color: 'primary.main', borderBottom: 1, borderColor: 'divider' }}>
          <AddRounded fontSize="small" sx={{ mr: 1 }} />
          {t('addSource')}
        </MenuItem>
        <MenuItem value="">{noneLabel}</MenuItem>
        {/* Keeps an unknown (e.g. deleted) source displayable. */}
        {value && !sources.some((source) => source.id === value) && (
          <MenuItem value={value} sx={{ display: 'none' }}>
            {value}
          </MenuItem>
        )}
        {sources.map((source) => (
          <MenuItem key={source.id} value={source.id}>
            {source.name || source.id}
          </MenuItem>
        ))}
      </TextField>
      <NewSourceDialog
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(id) => {
          setAdding(false)
          onChange(id)
        }}
      />
    </>
  )
}
