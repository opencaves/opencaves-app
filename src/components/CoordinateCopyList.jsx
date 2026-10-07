import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip } from '@mui/material'
import ContentCopy from '@mui/icons-material/ContentCopy'
import DirectionsOutlined from '@mui/icons-material/DirectionsOutlined'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { openDirections } from '@/utils/directions.js'
import { getOS } from '@/utils/getOS.js'

// "Copied to clipboard", after a row's copy - except on Android (13+), which
// says so itself.
export function useCopiedConfirmation() {
  const { t } = useTranslation('resultPane')
  const [openSnackbar] = useSnackbar()
  const isAndroid = getOS() === 'Android'
  return () => {
    if (!isAndroid) openSnackbar(t('copiedToClipboard'), { severity: 'success' })
  }
}

// One point's row: its icon, its coordinates (a click copies them, the copy
// icon at its end saying so on hover - tooltip: false leaves the tooltip out,
// on phones), and a Directions button at its right. Also the map pane's rows
// (in its own list): they carry its class names too (oc-icon-copy...), which
// its styles use.
export function CoordinateRow({ icon, text, copyText, copyLabel, point, directionsLabel, onCopied, tooltip = true }) {
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const copyIconRef = useRef(null)
  const directionsRef = useRef(null)
  // The "Copy …" tooltip centred under the copy icon, as low as the
  // Directions button's (the icon's left and width, the button's top and height).
  const underCopyIcon = {
    popper: {
      anchorEl: () => {
        const iconEl = copyIconRef.current
        const button = directionsRef.current
        if (!iconEl || !button) return iconEl
        return {
          getBoundingClientRect: () => {
            const { left, width } = iconEl.getBoundingClientRect()
            const { top, height } = button.getBoundingClientRect()
            return new DOMRect(left, top, width, height)
          },
        }
      },
    },
  }
  return (
    <CopyToClipboard
      text={copyText}
      onCopy={() => {
        setTooltipOpen(false)
        onCopied()
      }}
    >
      <ListItem
        disablePadding
        secondaryAction={
          <Tooltip title={directionsLabel}>
            {/* Its click stops here: the row's copy (CopyToClipboard, around
                the whole row) would otherwise run too, and fail. */}
            <IconButton
              ref={directionsRef}
              className="oc-coordinate-copy-list--directions oc-results-copy-list--directions"
              aria-label={directionsLabel}
              onClick={(event) => {
                event.stopPropagation()
                openDirections(point)
              }}
            >
              <DirectionsOutlined />
            </IconButton>
          </Tooltip>
        }
      >
        <Tooltip describeChild title={copyLabel} slotProps={underCopyIcon} open={tooltip && tooltipOpen} onOpen={() => setTooltipOpen(true)} onClose={() => setTooltipOpen(false)}>
          <ListItemButton>
            <ListItemIcon>{icon}</ListItemIcon>
            <ListItemText primary={text} />
            <ListItemIcon ref={copyIconRef} className="oc-coordinate-copy-list--copy oc-icon-copy-container">
              <ContentCopy className="oc-icon-copy" sx={{ fontSize: '1.125rem' }} />
            </ListItemIcon>
          </ListItemButton>
        </Tooltip>
      </ListItem>
    </CopyToClipboard>
  )
}

// A record's points (a cave's location, entrance and keys; a system's
// location) laid out as in the map pane's list: each copies its coordinates
// when clicked and has a Directions button. rows: { key, icon, text,
// copyText, copyLabel, point ({ latitude, longitude }), directionsLabel }.
export default function CoordinateCopyList({ rows, sx }) {
  const onCopied = useCopiedConfirmation()
  return (
    <List
      dense
      disablePadding
      className="oc-coordinate-copy-list"
      sx={[
        {
          // MD3: the Directions button 16dp from the end, 16dp between it and
          // the copy icon.
          '--oc-directions-inset': '0px',
          '& .MuiListItemButton-root': { borderRadius: 2, py: 0.75, pl: 1, pr: 'calc(var(--oc-directions-inset) + 40px + 16px)' },
          '& .MuiListItemSecondaryAction-root': { right: 'var(--oc-directions-inset)' },
          '& .MuiListItemIcon-root': { minWidth: 40, color: 'primary.main' },
          '& .oc-coordinate-copy-list--copy': { minWidth: 18, justifyContent: 'flex-end', color: 'text.secondary' },
          '& .MuiListItemText-primary': { fontVariantNumeric: 'tabular-nums' },
          // With a mouse, the copy icon shows while its row is hovered.
          '@media (hover: hover)': {
            '& .oc-coordinate-copy-list--copy': { visibility: 'hidden' },
            '& .MuiListItem-root:hover .oc-coordinate-copy-list--copy': { visibility: 'visible' },
          },
          // Hovering the Directions button lights its row too.
          '& .MuiListItem-root:has(.oc-coordinate-copy-list--directions:hover) > .MuiListItemButton-root': { bgcolor: 'action.hover' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {rows.map(({ key, ...row }) => (
        <CoordinateRow key={key} {...row} onCopied={onCopied} />
      ))}
    </List>
  )
}
