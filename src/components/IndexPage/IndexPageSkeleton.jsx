import { Box, Skeleton } from '@mui/material'
import ListSkeleton from '@/components/Skeletons/ListSkeleton.jsx'

// An index page while the cave data loads (a first visit): its heading,
// then grouped rows.
export default function IndexPageSkeleton() {
  return (
    <Box className="oc-index-page-skeleton">
      <Box aria-hidden="true" sx={{ mb: 3 }}>
        <Skeleton variant="text" sx={{ typography: { xs: 'h5', sm: 'h4' }, width: 'min(100%, 420px)' }} />
        <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: 120 }} />
      </Box>
      <ListSkeleton rows={10} leading={null} secondary={false} grouped />
    </Box>
  )
}
