import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import CaveModel from '@/models/CaveModel.js'
import SistemaModel from '@/models/SistemaModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'

const areasModel = createCollectionModel('areas')

// Rendering thousands of options at once makes the list sluggish; people
// narrow it down by typing anyway.
const MAX_OPTIONS = 100

function normalize(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// Split out so the Firestore listeners only run while the dialog is open (MUI
// unmounts Dialog children when closed), not once per markdown field on the page.
function CaveLinkDialogContent({ initialCaveId, onClose, onConfirm }) {
  const { t } = useTranslation('markdownField')
  const [caves, loading] = CaveModel.useAll()
  const [sistemas] = SistemaModel.useAll()
  const [areas] = areasModel.useAll()
  const [selectedId, setSelectedId] = useState(initialCaveId || null)

  const sistemasById = useMemo(() => new Map(sistemas.map((sistema) => [sistema.id, sistema])), [sistemas])
  const areaNames = useMemo(() => new Map(areas.map((area) => [area.id, area.name])), [areas])
  // Cave names are stored as `{ value }` objects in Firestore; flattened
  // here so the picker deals in plain strings. A cave has no area of its
  // own - it comes from its sistema. Sorted by area (caves without one
  // last), then name, since Autocomplete's groupBy needs options grouped.
  const sortedCaves = useMemo(
    () =>
      caves
        .map((cave) => {
          const sistema = sistemasById.get(cave.sistemaId)
          const area = sistema?.area ? areaNames.get(sistema.area) || sistema.area : null
          return { id: cave.id, name: cave.name?.value || '', aka: cave.aka || [], sistemaName: sistema?.name || null, area }
        })
        .filter((cave) => cave.name)
        .sort((first, second) => (first.area === second.area ? 0 : first.area === null ? 1 : second.area === null ? -1 : first.area.localeCompare(second.area)) || first.name.localeCompare(second.name)),
    [caves, sistemasById, areaNames],
  )
  const selected = sortedCaves.find((cave) => cave.id === selectedId) || null

  // Matches cave names, alternate names and area names.
  function filterOptions(options, { inputValue }) {
    const term = normalize(inputValue.trim())
    const matches = term ? options.filter((cave) => [cave.name, ...cave.aka, cave.area].some((text) => normalize(text).includes(term))) : options
    return matches.slice(0, MAX_OPTIONS)
  }

  return (
    <>
      <DialogTitle>{t('toolbar.linkCaveTitle')}</DialogTitle>
      <DialogContent>
        <Autocomplete
          sx={{ pt: 1 }}
          options={sortedCaves}
          loading={loading}
          value={selected}
          onChange={(event, cave) => setSelectedId(cave?.id || null)}
          filterOptions={filterOptions}
          getOptionLabel={(cave) => cave.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          noOptionsText={t('toolbar.linkCaveNoResults')}
          groupBy={(cave) => cave.area ?? t('toolbar.linkCaveNoArea')}
          renderOption={({ key, ...props }, cave) => (
            <Box component="li" key={key} {...props} sx={{ display: 'flex', gap: 1 }}>
              {cave.name}
              {cave.sistemaName && (
                <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
                  {cave.sistemaName}
                </Typography>
              )}
            </Box>
          )}
          renderInput={(params) => <TextField {...params} autoFocus label={t('toolbar.linkCaveSearch')} />}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('toolbar.linkCancel')}</Button>
        <Button variant="contained" disabled={!selected} onClick={() => onConfirm(selected)}>
          {t('save')}
        </Button>
      </DialogActions>
    </>
  )
}

export default function CaveLinkDialog({ open, initialCaveId, onClose, onConfirm }) {
  return (
    <Dialog className="oc-cave-link-dialog" open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <CaveLinkDialogContent initialCaveId={initialCaveId} onClose={onClose} onConfirm={onConfirm} />
    </Dialog>
  )
}
