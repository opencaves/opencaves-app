import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button } from '@mui/material'
import { ShowAllPane } from '@/components/Carousel/Carousel.jsx'

/**
 * A strip's Show all link, at its bottom right (MD3's carousel: a small text
 * button right under it, still a 48dp target), opening {@link ShowAllPane}:
 * every item in a grid (full screen on phones, swapped in). Its children are
 * the pane's items - `<li>`s, each one's visual marked `.oc-carousel--media`.
 *
 * @param {object} props
 * @param {string} props.title - The strip's name: the pane's title, and the link's label for screen readers.
 * @param {string} [props.gridMinWidth] - The pane's narrowest column.
 * @param {React.ReactNode} props.children
 */
export default function StripShowAll({ title, gridMinWidth, children }) {
  const { t } = useTranslation('app', { keyPrefix: 'carousel' })
  const [open, setOpen] = useState(false)
  return (
    <>
      {/* Clear of the line under the strip (wider screens). */}
      <Box className="oc-strip-show-all" sx={{ display: 'flex', justifyContent: 'flex-end', mt: { xs: 0.5, sm: 2 }, mb: -1.5, mr: -1 }}>
        <Button size="small" onClick={() => setOpen(true)} aria-label={t('showAll', { title })} aria-haspopup="dialog" sx={{ minHeight: 32, position: 'relative', '&::before': { content: '""', position: 'absolute', inset: '-8px 0' } }}>
          {t('showAllLink')}
        </Button>
      </Box>
      <ShowAllPane open={open} onClose={() => setOpen(false)} title={title} gridMinWidth={gridMinWidth}>
        {children}
      </ShowAllPane>
    </>
  )
}
