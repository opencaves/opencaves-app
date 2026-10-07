import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuItem, TextField } from '@mui/material'
import AddRounded from '@mui/icons-material/AddRounded'
import NewSourceDialog from '@/components/NewSourceDialog.jsx'

// Not a real source id: picking it opens NewSourceDialog instead of
// becoming the value.
const ADD_SOURCE = '__add-source__'

// An edit form's Source picker (the `sources` collection), starting with an
// "Add a source" entry that creates one in place (NewSourceDialog) and
// selects it. onChange gets the chosen source id ('' for none). As wide as
// its longest option (measured in the field's own font, with its padding and
// arrow), never wider than its row.
export default function SourceSelect({ label, value, onChange, sources, noneLabel, helperText, className }) {
  const { t } = useTranslation('newSourceDialog')
  const [adding, setAdding] = useState(false)
  const rootRef = useRef(null)
  const [width, setWidth] = useState(null)
  const names = JSON.stringify(sources.map((source) => source.name || source.id))

  useLayoutEffect(() => {
    const select = rootRef.current?.querySelector('.MuiSelect-select')
    if (!select) return
    const style = getComputedStyle(select)
    const context = document.createElement('canvas').getContext('2d')
    context.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    // The theme's letter spacing, which canvas ignores unless told.
    context.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing
    // "Add a source" also has its icon (20px) and its gap (8px).
    const texts = [noneLabel, ...JSON.parse(names)].map((text) => context.measureText(text || '').width)
    const widest = Math.max(context.measureText(t('addSource')).width + 28, ...texts)
    const chrome = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 2
    setWidth(Math.ceil(widest + chrome))
  }, [names, noneLabel, t])

  return (
    <>
      <TextField
        select
        ref={rootRef}
        className={`oc-source-select${className ? ` ${className}` : ''}`}
        label={label}
        helperText={helperText}
        fullWidth={!width}
        sx={width ? { width, maxWidth: '100%' } : undefined}
        value={value}
        onChange={(event) => {
          if (event.target.value === ADD_SOURCE) setAdding(true)
          else onChange(event.target.value)
        }}
      >
        {/* A border, not a <Divider>: Select gives every child the option
            role, so a divider would read as a blank choice. */}
        <MenuItem value={ADD_SOURCE} sx={{ color: 'var(--mui-sys-color-primary)', borderBottom: 1, borderColor: 'divider' }}>
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
