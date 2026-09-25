import { useState } from 'react'
import { Box, Tab, Tabs, TextField, Typography } from '@mui/material'
import Markdown from './Markdown.jsx'

// A markdown textarea with an horizontal-tab switch to a rendered preview,
// instead of showing both stacked on top of each other.
export default function MarkdownField({ label, value, onChange, minRows = 3, resizable = false, editTabLabel = 'Markdown', previewTabLabel = 'Preview', emptyPreviewLabel = 'Nothing to preview yet' }) {
  const [tab, setTab] = useState('edit')

  return (
    <Box className="oc-markdown-field">
      <Typography variant="subtitle2" color="text.secondary" component="div" sx={{ mt: '0.5rem', mb: 0.5, fontWeight: 'normal' }}>
        {label}
      </Typography>
      <Tabs value={tab} onChange={(e, newTab) => setTab(newTab)} sx={{ minHeight: 32, mb: 1 }}>
        <Tab value="edit" label={editTabLabel} sx={{ minHeight: 32, py: 0 }} />
        <Tab value="preview" label={previewTabLabel} sx={{ minHeight: 32, py: 0 }} />
      </Tabs>
      {tab === 'edit' ? <TextField fullWidth multiline minRows={minRows} value={value} onChange={onChange} sx={resizable ? { '& textarea': { resize: 'vertical' } } : undefined} /> : <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, minHeight: `${minRows * 1.4375 + 1}em` }}>{value ? <Markdown>{value}</Markdown> : <Typography color="text.secondary">{emptyPreviewLabel}</Typography>}</Box>}
    </Box>
  )
}
