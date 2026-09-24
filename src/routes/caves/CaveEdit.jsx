import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Box, Button, Checkbox, FormControlLabel, Grid, MenuItem, TextField, Typography } from '@mui/material'
import CaveModel from '@/models/CaveModel.js'
import SistemaModel from '@/models/SistemaModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'
import { num } from '@/services/data-service/types.js'
import Markdown from '@/components/Markdown/Markdown.jsx'

const areasModel = createCollectionModel('areas')
const sourcesModel = createCollectionModel('sources')
const accessesModel = createCollectionModel('accesses')
const accessibilitiesModel = createCollectionModel('accessibilities')

const emptyForm = {
  name: '',
  sistemaId: '',
  sistemaColor: '',
  area: '',
  source: '',
  access: '',
  accessDetails: '',
  accessibility: '',
  accessibilityDetails: '',
  description: '',
  direction: '',
  fees: false,
  facilities: false,
  activities: false,
  explorationDate: '',
  rating: '',
  reporter: '',
  note: '',
  aka: '',
  maps: '',
  longitude: '',
  latitude: '',
  entranceLongitude: '',
  entranceLatitude: '',
}

function MarkdownField({ label, value, onChange }) {
  return (
    <>
      <TextField label={label} fullWidth multiline minRows={3} value={value} onChange={onChange} />
      {value && (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Preview
          </Typography>
          <Markdown>{value}</Markdown>
        </Box>
      )}
    </>
  )
}

export default function CaveEdit() {
  const { caveId } = useParams()
  const navigate = useNavigate()
  const { setTitle } = useTitle()

  const [sistemas] = SistemaModel.useAll()
  const [areas] = areasModel.useAll()
  const [sources] = sourcesModel.useAll()
  const [accesses] = accessesModel.useAll()
  const [accessibilities] = accessibilitiesModel.useAll()

  function normalizeCoordinateValue(value) {
    if (value === '' || value === null || typeof value === 'undefined') {
      return ''
    }

    const normalized = Number(num(value, 5))
    return Number.isFinite(normalized) ? String(normalized) : ''
  }

  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isNew, setIsNew] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const cave = await CaveModel.getById(caveId)

      if (cancelled) {
        return
      }

      setIsNew(!cave)
      setForm({
        name: cave?.name?.value || '',
        sistemaId: cave?.sistemaId || '',
        sistemaColor: cave?.sistemaColor || '',
        area: cave?.area || '',
        source: cave?.source || '',
        access: cave?.access || '',
        accessDetails: cave?.accessDetails || '',
        accessibility: cave?.accessibility || '',
        accessibilityDetails: cave?.accessibilityDetails || '',
        description: cave?.description || '',
        direction: cave?.direction || '',
        fees: !!cave?.fees,
        facilities: !!cave?.facilities,
        activities: !!cave?.activities,
        explorationDate: cave?.explorationDate || '',
        rating: cave?.rating ?? '',
        reporter: cave?.reporter || '',
        note: cave?.note || '',
        aka: (cave?.aka || []).join('|'),
        maps: (cave?.maps || []).join('|'),
        longitude: normalizeCoordinateValue(cave?.location?.longitude ?? ''),
        latitude: normalizeCoordinateValue(cave?.location?.latitude ?? ''),
        entranceLongitude: normalizeCoordinateValue(cave?.entrance?.longitude ?? ''),
        entranceLatitude: normalizeCoordinateValue(cave?.entrance?.latitude ?? ''),
      })
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [caveId])

  useEffect(() => {
    setTitle(isNew ? 'New cave' : form.name || caveId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, form.name])

  function field(name) {
    return {
      value: form[name],
      onChange: (e) => setForm((f) => ({ ...f, [name]: ['longitude', 'latitude', 'entranceLongitude', 'entranceLatitude'].includes(name) ? normalizeCoordinateValue(e.target.value) : e.target.value })),
    }
  }

  function checkboxField(name) {
    return {
      checked: form[name],
      onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.checked })),
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const fields = {
        name: { value: form.name },
        sistemaId: form.sistemaId || undefined,
        sistemaColor: form.sistemaColor || undefined,
        area: form.area || undefined,
        source: form.source || undefined,
        access: form.access || undefined,
        accessDetails: form.accessDetails || undefined,
        accessibility: form.accessibility || undefined,
        accessibilityDetails: form.accessibilityDetails || undefined,
        description: form.description || undefined,
        direction: form.direction || undefined,
        fees: form.fees,
        facilities: form.facilities,
        activities: form.activities,
        explorationDate: form.explorationDate || undefined,
        rating: form.rating === '' ? undefined : Number(form.rating),
        reporter: form.reporter || undefined,
        note: form.note || undefined,
        aka: form.aka
          ? form.aka
              .split('|')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        maps: form.maps
          ? form.maps
              .split('|')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      }

      if (form.longitude !== '' && form.latitude !== '') {
        fields.location = { longitude: Number(num(form.longitude, 5)), latitude: Number(num(form.latitude, 5)) }
      }

      if (form.entranceLongitude !== '' && form.entranceLatitude !== '') {
        fields.entrance = { longitude: Number(num(form.entranceLongitude, 5)), latitude: Number(num(form.entranceLatitude, 5)) }
      }

      await CaveModel.save(caveId, fields)

      invalidateData()
      await getData()
      navigate('/caves')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this cave?')) {
      return
    }
    await CaveModel.remove(caveId)
    invalidateData()
    await getData()
    navigate('/caves')
  }

  if (loading) {
    return <Typography>Loading…</Typography>
  }

  return (
    <div>
      <Typography component="h1" variant="h5" sx={{ mb: 2 }}>
        {isNew ? 'New cave' : form.name || caveId}
      </Typography>

      <Grid container spacing={2} sx={{ maxWidth: 720 }}>
        <Grid size={12}>
          <TextField label="Name" fullWidth required {...field('name')} />
        </Grid>

        <Grid size={6}>
          <TextField select label="Sistema" fullWidth {...field('sistemaId')}>
            <MenuItem value="">(none)</MenuItem>
            {[...sistemas]
              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
              .map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name || s.id}
                </MenuItem>
              ))}
          </TextField>
        </Grid>
        <Grid size={6}>
          <TextField label="Sistema color override" fullWidth {...field('sistemaColor')} placeholder="#rrggbb" />
        </Grid>

        <Grid size={6}>
          <TextField select label="Area" fullWidth {...field('area')}>
            <MenuItem value="">(none)</MenuItem>
            {areas.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={6}>
          <TextField select label="Source" fullWidth {...field('source')}>
            <MenuItem value="">(none)</MenuItem>
            {sources.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid size={6}>
          <TextField label="Longitude" type="number" fullWidth {...field('longitude')} />
        </Grid>
        <Grid size={6}>
          <TextField label="Latitude" type="number" fullWidth {...field('latitude')} />
        </Grid>

        <Grid size={6}>
          <TextField label="Entrance longitude" type="number" fullWidth {...field('entranceLongitude')} />
        </Grid>
        <Grid size={6}>
          <TextField label="Entrance latitude" type="number" fullWidth {...field('entranceLatitude')} />
        </Grid>

        <Grid size={6}>
          <TextField select label="Access" fullWidth {...field('access')} slotProps={{ select: { renderValue: (value) => accesses.find((a) => a.id === value)?.name || '' } }}>
            <MenuItem value="">(none)</MenuItem>
            {accesses.map((a) => (
              <MenuItem key={a.id} value={a.id} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="body1">{a.name}</Typography>
                {a.description && (
                  <Typography variant="body2" color="text.secondary">
                    {a.description}
                  </Typography>
                )}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={6}>
          <TextField select label="Accessibility" fullWidth {...field('accessibility')} slotProps={{ select: { renderValue: (value) => accessibilities.find((a) => a.id === value)?.name || '' } }}>
            <MenuItem value="">(none)</MenuItem>
            {accessibilities.map((a) => (
              <MenuItem key={a.id} value={a.id} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="body1">{a.name}</Typography>
                {a.description && (
                  <Typography variant="body2" color="text.secondary">
                    {a.description}
                  </Typography>
                )}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid size={12}>
          <MarkdownField label="Access details (markdown)" value={form.accessDetails} onChange={(e) => setForm((f) => ({ ...f, accessDetails: e.target.value }))} />
        </Grid>
        <Grid size={12}>
          <MarkdownField label="Accessibility details (markdown)" value={form.accessibilityDetails} onChange={(e) => setForm((f) => ({ ...f, accessibilityDetails: e.target.value }))} />
        </Grid>
        <Grid size={12}>
          <MarkdownField label="Description (markdown)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </Grid>
        <Grid size={12}>
          <MarkdownField label="Getting there (markdown)" value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))} />
        </Grid>

        <Grid size={6}>
          <FormControlLabel control={<Checkbox {...checkboxField('fees')} />} label="Fees" />
        </Grid>
        <Grid size={6}>
          <FormControlLabel control={<Checkbox {...checkboxField('facilities')} />} label="Facilities" />
        </Grid>
        <Grid size={6}>
          <FormControlLabel control={<Checkbox {...checkboxField('activities')} />} label="Activities" />
        </Grid>

        <Grid size={6}>
          <TextField label="Exploration date" fullWidth {...field('explorationDate')} />
        </Grid>
        <Grid size={6}>
          <TextField label="Rating" type="number" fullWidth {...field('rating')} />
        </Grid>

        <Grid size={12}>
          <TextField label="Reported by" fullWidth {...field('reporter')} />
        </Grid>
        <Grid size={12}>
          <TextField label="AKA (| separated)" fullWidth {...field('aka')} />
        </Grid>
        <Grid size={12}>
          <TextField label="Maps (| separated)" fullWidth {...field('maps')} />
        </Grid>
        <Grid size={12}>
          <TextField label="Note" fullWidth multiline minRows={2} {...field('note')} />
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>
          Save
        </Button>
        <Button onClick={() => navigate('/caves')} disabled={saving}>
          Cancel
        </Button>
        {!isNew && (
          <Button color="error" onClick={handleDelete} disabled={saving} sx={{ ml: 'auto' }}>
            Delete
          </Button>
        )}
      </Box>
    </div>
  )
}
