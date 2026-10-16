import { useTranslation } from 'react-i18next'
import { Avatar, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, List, ListItem, ListItemAvatar, ListItemText } from '@mui/material'
import ImageRounded from '@mui/icons-material/ImageRounded'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'
import SistemaModel from '@/models/SistemaModel.js'

/**
 * Asked before uploading a file already on OpenCaves (the same contentHash):
 * the identical maps, each with the systems that list it, and two ways on -
 * attach the existing map (the first, a listed one first: no upload) or upload
 * anyway (the admins then get a task about it). The X cancels: nothing added.
 *
 * @param {object} props
 * @param {{file: File, maps: CaveMap[]}|null} props.duplicate - Open while set.
 * @param {(answer: 'attach'|'upload'|null, map?: CaveMap) => void} props.onAnswer
 */
export default function DuplicateMapDialog({ duplicate, onAnswer }) {
  const { t } = useTranslation('mapsPicker', { keyPrefix: 'duplicate' })
  const [sistemas] = SistemaModel.useAll()
  const systemsOf = (map) => sistemas.filter((sistema) => (sistema.maps || []).includes(map.id)).map((sistema) => sistema.name || sistema.id)
  // A map some system lists first: the one to attach.
  const maps = [...(duplicate?.maps || [])].sort((a, b) => Number(systemsOf(b).length > 0) - Number(systemsOf(a).length > 0))

  return (
    <Dialog className="oc-duplicate-map-dialog" open={Boolean(duplicate)} onClose={() => onAnswer?.(null)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pr: 7 }}>{t('title')}</DialogTitle>
      <DialogCloseButton onClick={() => onAnswer?.(null)} label={t('cancel')} />
      <DialogContent>
        <DialogContentText>{t('text', { count: maps.length, file: duplicate?.file?.name || '' })}</DialogContentText>
        <List className="oc-duplicate-map-dialog--maps" dense>
          {maps.map((map) => {
            const systems = systemsOf(map)
            return (
              <ListItem key={map.id} disableGutters>
                <ListItemAvatar>
                  <Avatar variant="rounded" src={map.thumbnailUrl || map.previewUrl || (map.contentType?.startsWith('image/') ? map.url : undefined)} slotProps={{ img: { crossOrigin: 'anonymous' } }} sx={{ width: 56, height: 56, mr: 1.5 }}>
                    <ImageRounded />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary={map.name || t('untitled')} secondary={systems.length ? t('listedBy', { names: systems.join(', ') }) : t('notListed')} />
              </ListItem>
            )
          })}
        </List>
        <Box component="p" sx={{ typography: 'body2', color: 'text.secondary', m: 0 }}>
          {t('uploadAnywayHint')}
        </Box>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button className="oc-duplicate-map-dialog--upload" onClick={() => onAnswer?.('upload')}>
          {t('uploadAnyway')}
        </Button>
        <Button className="oc-duplicate-map-dialog--attach" variant="contained" disableElevation onClick={() => onAnswer?.('attach', maps[0])}>
          {t('attach')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
