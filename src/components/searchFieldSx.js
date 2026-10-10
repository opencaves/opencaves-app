import { SEARCH_BAR_HEIGHT, SEARCH_BAR_RADIUS } from '@/config/app.js'

/**
 * A page's search field (the index pages', the editors' lists'), as MD3's
 * search bar: 56dp tall, fully rounded, 16dp in to its 24dp search icon, 16dp
 * from it to the text, a trailing 40dp icon button (its clear button) centred
 * in a 48dp slot - its touch target - 4dp from the end; opaque inside only. The browser's own clear control for a
 * search input hidden (the field has its own).
 *
 * @param {import('@mui/material/styles').Theme} theme
 * @returns {object}
 */
export const SEARCH_FIELD_SX = (theme) => ({
  '& .MuiOutlinedInput-root': { height: SEARCH_BAR_HEIGHT, borderRadius: SEARCH_BAR_RADIUS, bgcolor: 'var(--oc-page-surface)', pl: 2, pr: 0.5 },
  '& .MuiOutlinedInput-input': { ...theme.typography.body1, py: 0 },
  '& .MuiInputAdornment-positionStart': { mr: 2, color: theme.vars.palette.text.secondary },
  '& .MuiInputAdornment-positionEnd': { ml: 0 },
  '& .MuiInputAdornment-root .MuiIconButton-root': { m: 0.5 },
  '& input::-webkit-search-cancel-button, & input::-webkit-search-decoration': { WebkitAppearance: 'none', display: 'none' },
})
