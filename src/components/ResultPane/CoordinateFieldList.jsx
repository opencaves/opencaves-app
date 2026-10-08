import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, ListItemText, Menu, MenuItem } from '@mui/material'
import ArrowDropDownRounded from '@mui/icons-material/ArrowDropDownRounded'
import AddButton from '@/components/AddButton.jsx'
import CoordinateField, { coordinateInRange } from './CoordinateField.jsx'

// A cave form's three coordinates (both cave forms keep the same form fields).
export function caveCoordinateItems(form, setForm, t) {
  return [
    { field: 'location', label: t('location'), longitude: form.longitude, latitude: form.latitude, onChange: ({ longitude, latitude }) => setForm((f) => ({ ...f, longitude, latitude })), validity: form.locationValidity, onValidityChange: (locationValidity) => setForm((f) => ({ ...f, locationValidity })) },
    { field: 'entrance', label: t('entrance'), longitude: form.entranceLongitude, latitude: form.entranceLatitude, onChange: ({ longitude, latitude }) => setForm((f) => ({ ...f, entranceLongitude: longitude, entranceLatitude: latitude })), validity: form.entranceValidity, onValidityChange: (entranceValidity) => setForm((f) => ({ ...f, entranceValidity })) },
    { field: 'key', label: t('key'), longitude: form.keyLongitude, latitude: form.keyLatitude, onChange: ({ longitude, latitude }) => setForm((f) => ({ ...f, keyLongitude: longitude, keyLatitude: latitude })), validity: form.keyValidity, onValidityChange: (keyValidity) => setForm((f) => ({ ...f, keyValidity })) },
  ]
}

// Whether a cave form's three coordinates are all within range (the forms
// don't save otherwise).
export function caveCoordinatesInRange(form) {
  return coordinateInRange(form.longitude, form.latitude) && coordinateInRange(form.entranceLongitude, form.entranceLatitude) && coordinateInRange(form.keyLongitude, form.keyLatitude)
}

const isFilled = ({ longitude, latitude }) => `${longitude ?? ''}` !== '' || `${latitude ?? ''}` !== ''

// A form's coordinates (a cave's location, entrance and key; a system's
// location), one of each at most: only those with a value are shown, the
// others offered by Add coordinates - a menu of them, or, with one left (a
// system's location, a cave's last), a button adding it by name ("Add
// entrance coordinates"). One added shows its empty field; its X clears it and
// puts it back in the menu. items: [{ field, label, longitude, latitude, onChange,
// validity?, onValidityChange? }]; fieldProps: shared by every field
// (mapBelowOnPhones, labelProps, canPickOnMap).
export default function CoordinateFieldList({ items, fieldProps = {}, sx }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  // Added in this session, still empty: shown all the same.
  const [added, setAdded] = useState([])
  const [menuAnchor, setMenuAnchor] = useState(null)
  const shown = items.filter((item) => isFilled(item) || added.includes(item.field))
  const missing = items.filter((item) => !shown.includes(item))

  function add(field) {
    setMenuAnchor(null)
    setAdded((fields) => [...fields, field])
  }

  function remove(item) {
    setAdded((fields) => fields.filter((field) => field !== item.field))
    item.onChange({ longitude: '', latitude: '' })
  }

  return (
    <Box className="oc-coordinate-field-list" sx={[{ display: 'flex', flexDirection: 'column', gap: 2 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {shown.map(({ field, ...item }) => (
        <CoordinateField key={field} field={field} {...fieldProps} {...item} onRemove={() => remove({ field, ...item })} />
      ))}
      {missing.length > 0 && (
        <Box>
          <AddButton
            className="oc-coordinate-field-list--add"
            endIcon={missing.length > 1 ? <ArrowDropDownRounded /> : undefined}
            aria-haspopup={missing.length > 1 ? 'menu' : undefined}
            aria-expanded={missing.length > 1 && menuAnchor ? 'true' : undefined}
            onClick={(event) => (missing.length > 1 ? setMenuAnchor(event.currentTarget) : add(missing[0].field))}
          >
            {missing.length > 1 ? t('addCoordinates') : t(`addOneCoordinates.${missing[0].field}`, { defaultValue: t('addCoordinates') })}
          </AddButton>
          <Menu className="oc-coordinate-field-list--menu" anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            {missing.map((item) => (
              <MenuItem key={item.field} onClick={() => add(item.field)}>
                <ListItemText>{item.label}</ListItemText>
              </MenuItem>
            ))}
          </Menu>
        </Box>
      )}
    </Box>
  )
}
