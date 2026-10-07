import { Box, Typography } from '@mui/material'

// How the site's searches (SiteSearch, AppBarSearch) show their suggestions
// (useSiteSearch): under a small heading per kind, each with its secondary
// text (a cave's system) beside it. groupLabel: a kind's heading.
export function renderSearchGroup(groupLabel) {
  return function SearchGroup(params) {
    return (
      <li key={params.key}>
        <Typography component="div" variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {groupLabel(params.group)}
        </Typography>
        <Box component="ul" sx={{ p: 0 }}>
          {params.children}
        </Box>
      </li>
    )
  }
}

export function renderSearchOption({ key, ...props }, option) {
  return (
    <li key={key} {...props}>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="span">{option.label}</Typography>
        {option.secondary && (
          <Typography component="span" variant="body2" sx={{ ml: 1, color: 'text.secondary' }}>
            {option.secondary}
          </Typography>
        )}
      </Box>
    </li>
  )
}
