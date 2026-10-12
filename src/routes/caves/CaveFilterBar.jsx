import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, Chip, ListItemIcon, ListItemText, ListSubheader, Menu, MenuItem, Typography } from '@mui/material'
import AddRounded from '@mui/icons-material/AddRounded'
import CancelRounded from '@mui/icons-material/CancelRounded'
import CheckRounded from '@mui/icons-material/CheckRounded'
import { FILTER_KINDS } from '@/utils/caveFilters.js'

/**
 * The caves' list's filters (utils/caveFilters.js): a chip for each one in
 * effect (its x removes it), and the Add filter menu - MD3's menu, each
 * criterion under its kind's heading, checked when in effect, with how many
 * caves the list would show with it.
 *
 * @param {object} props
 * @param {CaveFilters} props.filters
 * @param {Record<string, {value: string, label: string, chip?: string}[]>} props.options - Each kind's values (the
 *   menu's items), by kind; chip: its chip's label, when not its label.
 * @param {(kind: keyof CaveFilters, value: string, on: boolean) => void} props.onToggle - A value added to the
 *   filters, or removed.
 * @param {() => void} props.onClear - Every filter removed.
 * @param {(kind: keyof CaveFilters, value: string) => number|null} props.countWith - How many caves the list
 *   shows with the value added (null when unknown yet): read only while the menu is open.
 */
export default function CaveFilterBar({ filters, options, onToggle, onClear, countWith }) {
  const { t } = useTranslation('indexPages')
  const { t: tFilter } = useTranslation('filter')
  const [anchor, setAnchor] = useState(null)
  const headings = {
    missing: tFilter('needsHelp.heading'),
    type: tFilter('cenoteType.heading'),
    area: tFilter('areas.heading'),
    access: tFilter('access.heading'),
    accessibility: tFilter('accessibility.heading'),
  }
  // Needs help first in the menu: what the list is mostly filtered for.
  const menuKinds = /** @type {(keyof CaveFilters)[]} */ (['missing', ...FILTER_KINDS.map(({ key }) => key).filter((key) => key !== 'missing')])
  const chips = FILTER_KINDS.flatMap(({ key }) => filters[key].map((value) => {
    const option = options[key]?.find((item) => item.value === value)
    return { kind: key, value, label: option?.chip || option?.label || value }
  }))
  const several = chips.length > 1

  return (
    <Box className="oc-cave-filter-bar" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 3 }}>
      {chips.map(({ kind, value, label }) => (
        <Chip
          key={`${kind}=${value}`}
          className="oc-cave-filter-bar--chip"
          color="primary"
          label={label}
          onDelete={() => onToggle(kind, value, false)}
          // Its own icon, to name it: a Chip has no deleteIcon slot.
          deleteIcon={<CancelRounded aria-label={t('caves.filters.remove', { label })} />}
        />
      ))}
      <Button
        className="oc-cave-filter-bar--add"
        variant="outlined"
        size="small"
        startIcon={<AddRounded />}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ borderRadius: 2, height: 32 }}
      >
        {t('caves.filters.add')}
      </Button>
      {several && (
        <Button className="oc-cave-filter-bar--clear" size="small" onClick={onClear} sx={{ height: 32 }}>
          {t('caves.filters.clearAll')}
        </Button>
      )}
      <Menu
        className="oc-cave-filter-bar--menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { maxHeight: 'min(70vh, 560px)', minWidth: 260 } }, list: { dense: true, 'aria-label': tFilter('windowTitle') } }}
      >
        {/* Flat (a Menu takes no Fragment): each kind's heading, then its items. */}
        {anchor &&
          menuKinds.flatMap((kind) =>
            options[kind]?.length
              ? [
                  <ListSubheader key={`${kind}-heading`} className="oc-cave-filter-bar--heading" sx={{ lineHeight: '36px', fontWeight: 500, color: 'text.primary', bgcolor: 'inherit', backgroundImage: 'inherit' }}>
                    {headings[kind]}
                  </ListSubheader>,
                  ...options[kind].map(({ value, label }) => {
                    const checked = filters[kind].includes(value)
                    const count = countWith(kind, value)
                    return (
                      <MenuItem key={`${kind}=${value}`} className="oc-cave-filter-bar--item" role="menuitemcheckbox" aria-checked={checked} onClick={() => onToggle(kind, value, !checked)}>
                        <ListItemIcon sx={{ color: 'primary.main' }}>{checked && <CheckRounded fontSize="small" />}</ListItemIcon>
                        <ListItemText>{label}</ListItemText>
                        {count != null && (
                          <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
                            {count}
                          </Typography>
                        )}
                      </MenuItem>
                    )
                  }),
                ]
              : [],
          )}
      </Menu>
    </Box>
  )
}
