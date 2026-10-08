import { useState } from 'react'
import { Autocomplete, TextField, createFilterOptions } from '@mui/material'
import { useTranslation } from 'react-i18next'

const filter = createFilterOptions()

// The values typed, cut at commas and semicolons (a pasted list), trimmed.
const split = (text) => String(text || '').split(/\s*[,;]\s*/).map((part) => part.trim()).filter(Boolean)

// Without the repeats (the same name in another case).
function unique(values) {
  const seen = new Set()
  return values.filter((value) => {
    const key = value.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Several free-text values as chips (e.g. an exploration's team: one chip per
// person or group), suggesting the values already in use so people reuse the
// existing spelling. Enter, a comma or a semicolon makes a chip, a pasted
// "A, B, C" makes three, and the text still typed when leaving the field is
// kept. A new value is offered as an explicit "Add" entry. onChange receives
// the list of strings.
export default function CreatableChipsField({ label, value, onChange, options, size, fullWidth = true, className }) {
  const { t } = useTranslation('creatableTextField')
  const [input, setInput] = useState('')
  const values = Array.isArray(value) ? value : []

  function add(texts) {
    const next = unique([...values, ...texts.flatMap(split)])
    if (next.length !== values.length) onChange(next)
    setInput('')
  }

  return (
    <Autocomplete
      className={['oc-creatable-chips-field', className].filter(Boolean).join(' ')}
      multiple
      freeSolo
      selectOnFocus
      handleHomeEndKeys
      fullWidth={fullWidth}
      size={size}
      options={options}
      value={values}
      inputValue={input}
      onInputChange={(event, next, reason) => {
        if (reason === 'reset') return
        // A comma or semicolon typed (or pasted) ends a chip.
        if (/[,;]/.test(next)) add([next])
        else setInput(next)
      }}
      onChange={(event, next) => {
        onChange(unique(next.flatMap((option) => split(typeof option === 'string' ? option : option.inputValue))))
        setInput('')
      }}
      onBlur={() => input.trim() && add([input])}
      filterOptions={(allOptions, params) => {
        const filtered = filter(allOptions.filter((option) => !values.some((v) => v.toLowerCase() === option.toLowerCase())), params)
        const typed = params.inputValue.trim()
        if (typed && !allOptions.some((option) => option.toLowerCase() === typed.toLowerCase())) filtered.push({ inputValue: typed })
        return filtered
      }}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.inputValue)}
      renderOption={({ key, ...props }, option) => (
        <li key={key} {...props}>
          {typeof option === 'string' ? option : t('add', { value: option.inputValue })}
        </li>
      )}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  )
}
