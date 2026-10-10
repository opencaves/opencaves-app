import { Autocomplete, TextField, createFilterOptions } from '@mui/material'
import { useTranslation } from 'react-i18next'

const filter = createFilterOptions()

/**
 * A free-text field that suggests values already in use (e.g. every team or
 * reporter name entered so far), so people reuse the existing spelling but
 * can still edit it or type a new one. A new value is offered as an explicit
 * "Add" entry; the typed text is kept even if that entry isn't picked.
 *
 * @param {object} props
 * @param {(value: string) => void} props.onChange - Receives the plain string value.
 */
export default function CreatableTextField({ label, value, onChange, options, size, fullWidth = true, className }) {
  const { t } = useTranslation('creatableTextField')

  return (
    <Autocomplete
      className={['oc-creatable-text-field', className].filter(Boolean).join(' ')}
      freeSolo
      selectOnFocus
      handleHomeEndKeys
      fullWidth={fullWidth}
      size={size}
      options={options}
      value={value || null}
      inputValue={value || ''}
      onInputChange={(event, nextValue) => onChange(nextValue)}
      onChange={(event, option) => onChange(typeof option === 'string' ? option : option?.inputValue || '')}
      filterOptions={(allOptions, params) => {
        const filtered = filter(allOptions, params)
        const input = params.inputValue.trim()
        if (input && !allOptions.some((option) => option.toLowerCase() === input.toLowerCase())) filtered.push({ inputValue: input })
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
