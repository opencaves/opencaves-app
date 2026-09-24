import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Box, Button, Grid, MenuItem, TextField, Typography } from '@mui/material'
import SistemaModel from '@/models/SistemaModel.js'
import ConnectionModel from '@/models/ConnectionModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'
import { num } from '@/services/data-service/types.js'
import Markdown from '@/components/Markdown/Markdown.jsx'

const areasModel = createCollectionModel('areas')
const sourcesModel = createCollectionModel('sources')

const emptyForm = {
  name: '',
  color: '',
  area: '',
  description: '',
  direction: '',
  length: '',
  maxDepth: '',
  source: '',
  explorationDate: '',
  reporter: '',
  note: '',
  aka: '',
  maps: '',
  longitude: '',
  latitude: '',
  parentSistemaId: '',
}

export default function SistemaEdit() {
  const { sistemaId } = useParams()
  const navigate = useNavigate()
  const { setTitle } = useTitle()

  const [sistemas] = SistemaModel.useAll()
  const [areas] = areasModel.useAll()
  const [sources] = sourcesModel.useAll()

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
      const [sistema, connection] = await Promise.all([
        SistemaModel.getById(sistemaId),
        ConnectionModel.getBySistemaId(sistemaId),
      ])

      if (cancelled) {
        return
      }

      setIsNew(!sistema)
      setForm({
        name: sistema?.name || '',
        color: sistema?.color || '',
        area: sistema?.area || '',
        description: sistema?.description || '',
        direction: sistema?.direction || '',
        length: sistema?.length ?? '',
        maxDepth: sistema?.maxDepth ?? '',
        source: sistema?.source || '',
        explorationDate: sistema?.explorationDate || '',
        reporter: sistema?.reporter || '',
        note: sistema?.note || '',
        aka: (sistema?.aka || []).join('|'),
        maps: (sistema?.maps || []).join('|'),
        longitude: normalizeCoordinateValue(sistema?.location?.longitude ?? ''),
        latitude: normalizeCoordinateValue(sistema?.location?.latitude ?? ''),
        parentSistemaId: connection?.parentSistemaId || '',
      })
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [sistemaId])

  useEffect(() => {
    setTitle(isNew ? 'New sistema' : (form.name || sistemaId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, form.name])

  function field(name) {
    return {
      value: form[name],
      onChange: (e) => setForm(f => ({ ...f, [name]: ['longitude', 'latitude'].includes(name) ? normalizeCoordinateValue(e.target.value) : e.target.value }))
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const fields = {
        name: form.name,
        color: form.color || undefined,
        area: form.area || undefined,
        description: form.description || undefined,
        direction: form.direction || undefined,
        length: form.length === '' ? undefined : Number(form.length),
        maxDepth: form.maxDepth === '' ? undefined : Number(form.maxDepth),
        source: form.source || undefined,
        explorationDate: form.explorationDate || undefined,
        reporter: form.reporter || undefined,
        note: form.note || undefined,
        aka: form.aka ? form.aka.split('|').map(s => s.trim()).filter(Boolean) : undefined,
        maps: form.maps ? form.maps.split('|').map(s => s.trim()).filter(Boolean) : undefined,
        public: true,
      }

      if (form.longitude !== '' && form.latitude !== '') {
        fields.location = { longitude: Number(num(form.longitude, 5)), latitude: Number(num(form.latitude, 5)) }
      }

      await SistemaModel.save(sistemaId, fields)
      await ConnectionModel.setParent(sistemaId, form.parentSistemaId || null)

      invalidateData()
      await getData()
      navigate('/sistemas')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this sistema?')) {
      return
    }
    await SistemaModel.remove(sistemaId)
    invalidateData()
    await getData()
    navigate('/sistemas')
  }

  if (loading) {
    return <Typography>Loading…</Typography>
  }

  const otherSistemas = sistemas.filter(s => s.id !== sistemaId)

  return (
    <div>
      <Typography component="h1" variant="h5" sx={{ mb: 2 }}>{isNew ? 'New sistema' : form.name || sistemaId}</Typography>

      <Grid container spacing={2} sx={{ maxWidth: 720 }}>
        <Grid size={12}>
          <TextField label="Name" fullWidth required {...field('name')} />
        </Grid>

        <Grid size={6}>
          <TextField select label="Parent sistema" fullWidth {...field('parentSistemaId')}>
            <MenuItem value="">(none)</MenuItem>
            {otherSistemas.map(s => (
              <MenuItem key={s.id} value={s.id}>{s.name || s.id}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={6}>
          <TextField select label="Area" fullWidth {...field('area')}>
            <MenuItem value="">(none)</MenuItem>
            {areas.map(a => (
              <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid size={6}>
          <TextField label="Color" fullWidth {...field('color')} placeholder="#rrggbb" />
        </Grid>
        <Grid size={6}>
          <TextField select label="Source" fullWidth {...field('source')}>
            <MenuItem value="">(none)</MenuItem>
            {sources.map(s => (
              <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
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
          <TextField label="Length (m)" type="number" fullWidth {...field('length')} />
        </Grid>
        <Grid size={6}>
          <TextField label="Max depth (m)" type="number" fullWidth {...field('maxDepth')} />
        </Grid>

        <Grid size={12}>
          <TextField label="Description (markdown)" fullWidth multiline minRows={3} {...field('description')} />
        </Grid>
        {form.description && (
          <Grid size={12}>
            <Typography variant="caption" color="text.secondary">Preview</Typography>
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
              <Markdown>{form.description}</Markdown>
            </Box>
          </Grid>
        )}

        <Grid size={12}>
          <TextField label="Getting there (markdown)" fullWidth multiline minRows={2} {...field('direction')} />
        </Grid>

        <Grid size={6}>
          <TextField label="Exploration date" fullWidth {...field('explorationDate')} />
        </Grid>
        <Grid size={6}>
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
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>Save</Button>
        <Button onClick={() => navigate('/sistemas')} disabled={saving}>Cancel</Button>
        {!isNew && <Button color="error" onClick={handleDelete} disabled={saving} sx={{ ml: 'auto' }}>Delete</Button>}
      </Box>
    </div>
  )
}
