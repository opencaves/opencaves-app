import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { Box, Divider, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip } from '@mui/material'
import ContentCopy from '@mui/icons-material/ContentCopy'
import DirectionsOutlined from '@mui/icons-material/DirectionsOutlined'
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined'
import MyLocationOutlined from '@mui/icons-material/MyLocationOutlined'
import LocationDisabledOutlined from '@mui/icons-material/LocationDisabledOutlined'
import FenceRounded from '@mui/icons-material/FenceRounded'
import KeyRounded from '@mui/icons-material/KeyRounded'
import TerrainOutlined from '@mui/icons-material/TerrainOutlined'
import { Link as RouterLink } from 'react-router-dom'
import Markdown from '@/components/Markdown/Markdown.jsx'
import ConditionalWrapper from '@/components/utils/ConditionalWrapper.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import { getOS } from '@/utils/getOS.js'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { openDirections } from '@/utils/directions.js'
import { slugify } from '@/utils/slug.js'
import Address from './Address.jsx'
import QuickActions from './QuickActions.jsx'
import Access from './Access.jsx'
import SistemaHistory from './SistemaHistory.jsx'
import CaveMediaTabs from './CaveMediaTabs.jsx'
import './CurrentCaveDetailsContent.scss'

// Driving directions to a row's point, at the row's right (in the copy
// icon's colour).
function DirectionsAction({ point, label }) {
  return (
    <Tooltip title={label}>
      <IconButton className="oc-results-copy-list--directions" aria-label={label} onClick={() => openDirections(point)}>
        <DirectionsOutlined />
      </IconButton>
    </Tooltip>
  )
}

export default function CurrentCaveDetailsContent({ cave }) {
  const { t } = useTranslation('resultPane')

  const isSmall = useSmall()

  const [openSnackbar] = useSnackbar()

  const [addressTooltipOpen, setAddressTooltipOpen] = useState(false)
  const [coordinatesTooltipOpen, setCoordinatesTooltipOpen] = useState(false)
  const [keyCoordinatesTooltipOpen, setKeyCoordinatesTooltipOpen] = useState(false)
  const [entranceTooltipOpen, setEntranceTooltipOpen] = useState(false)
  // Each line's copy icon: its "Copy …" tooltip is centred under it, not
  // under the whole line, and as low as the Directions button's tooltip (the
  // icon's left and width, the button's top and height).
  const addressCopyRef = useRef(null)
  const coordinatesCopyRef = useRef(null)
  const keyCopyRefs = useRef([])
  const entranceCopyRef = useRef(null)
  const underCopyIcon = (getIcon) => ({
    popper: {
      anchorEl: () => {
        const icon = getIcon()
        const directions = icon?.closest('.MuiListItem-root')?.querySelector('.oc-results-copy-list--directions')
        if (!icon || !directions) return icon
        return {
          getBoundingClientRect: () => {
            const { left, width } = icon.getBoundingClientRect()
            const { top, height } = directions.getBoundingClientRect()
            return new DOMRect(left, top, width, height)
          },
        }
      },
    },
  })

  const isAndroid = getOS() === 'Android'

  let hasAddressOrCoordinates = false
  let address, addressText, coordinatesText, coordinatesTextCopy, keysTexts, entranceText

  if (cave.location) {
    address = <Address caveId={cave.id} longitude={cave.location.longitude} latitude={cave.location.latitude} />
    addressText = `${cave.location.latitude}, ${cave.location.longitude}`
    coordinatesText = `${cave.location.latitude}, ${cave.location.longitude}${cave.location.validity === 'unknown' ? ` (${t('coordinateValidityUnknown')})` : ``}`
    coordinatesTextCopy = `${cave.location.latitude}, ${cave.location.longitude}`
    hasAddressOrCoordinates = true
  }

  if (cave.keys) {
    keysTexts = cave.keys.map((key) => `${key.latitude}, ${key.longitude}`)
  }

  if (cave.entrance) {
    entranceText = `${cave.entrance.latitude}, ${cave.entrance.longitude}`
  }

  function handleAddressTooltipOpen() {
    setAddressTooltipOpen(true)
  }

  function handleAddressTooltipClose() {
    setAddressTooltipOpen(false)
  }

  function handleAddressCopy() {
    setAddressTooltipOpen(false)
    confirmCopied()
  }

  function handleCoordinatesTooltipOpen() {
    setCoordinatesTooltipOpen(true)
  }

  function handleCoordinatesTooltipClose() {
    setCoordinatesTooltipOpen(false)
  }

  function handleCoordinatesCopy() {
    setCoordinatesTooltipOpen(false)
    confirmCopied()
  }

  function handleKeyCoordinatesTooltipOpen() {
    setKeyCoordinatesTooltipOpen(true)
  }

  function handleKeyCoordinatesTooltipClose() {
    setKeyCoordinatesTooltipOpen(false)
  }

  function handleKeyCoordinatesCopy() {
    setKeyCoordinatesTooltipOpen(false)
    confirmCopied()
  }

  function handleEntranceTooltipOpen() {
    setEntranceTooltipOpen(true)
  }

  function handleEntranceTooltipClose() {
    setEntranceTooltipOpen(false)
  }

  function handleEntranceCopy() {
    setEntranceTooltipOpen(false)
    confirmCopied()
  }

  // Android (13+) already says the clipboard was written to.
  function confirmCopied() {
    if (!isAndroid) openSnackbar(t('copiedToClipboard'), { severity: 'success' })
  }

  return (
    <Box className="oc-current-cave-details-content oc-result-pane--content">
      <QuickActions cave={cave}></QuickActions>

      <Divider />

      <CaveMediaTabs caveId={cave.id} videos={cave.videos} sistemaId={cave.sistemaId} editable={false} />

      <Divider />

      <List dense className="oc-results-copy-list">
        {hasAddressOrCoordinates && (
          <>
            {address && (
              <CopyToClipboard text={addressText} placement="bottom-end" onCopy={handleAddressCopy}>
                <ListItem disablePadding secondaryAction={<DirectionsAction point={cave.location} label={t('directionsToCave')} />}>
                  <ConditionalWrapper
                    condition={!isSmall}
                    wrapper={(children) => (
                      <Tooltip title={t('copyAddress')} slotProps={underCopyIcon(() => addressCopyRef.current)} open={addressTooltipOpen} onOpen={handleAddressTooltipOpen} onClose={handleAddressTooltipClose}>
                        {children}
                      </Tooltip>
                    )}
                  >
                    <ListItemButton>
                      <ListItemIcon>
                        <LocationOnOutlined color="primary" />
                      </ListItemIcon>
                      <ListItemText primary={address} />
                      <ListItemIcon ref={addressCopyRef} className="oc-icon-copy-container">
                        <ContentCopy className="oc-icon-copy" style={{ fontSize: '1.125rem' }} />
                      </ListItemIcon>
                    </ListItemButton>
                  </ConditionalWrapper>
                </ListItem>
              </CopyToClipboard>
            )}

            {coordinatesText && (
              <CopyToClipboard text={coordinatesTextCopy} placement="bottom-end" onCopy={handleCoordinatesCopy}>
                <ListItem disablePadding secondaryAction={<DirectionsAction point={cave.location} label={t('directionsToCave')} />}>
                  <ConditionalWrapper
                    condition={!isSmall}
                    wrapper={(children) => (
                      <Tooltip title={t('copyCoordinates')} slotProps={underCopyIcon(() => coordinatesCopyRef.current)} open={coordinatesTooltipOpen} onOpen={handleCoordinatesTooltipOpen} onClose={handleCoordinatesTooltipClose}>
                        {children}
                      </Tooltip>
                    )}
                  >
                    <ListItemButton>
                      <ListItemIcon>
                        <MyLocationOutlined color="primary" />
                      </ListItemIcon>
                      <ListItemText primary={coordinatesText} />
                      <ListItemIcon ref={coordinatesCopyRef} className="oc-icon-copy-container">
                        <ContentCopy className="oc-icon-copy" style={{ fontSize: '1.125rem' }} />
                      </ListItemIcon>
                    </ListItemButton>
                  </ConditionalWrapper>
                </ListItem>
              </CopyToClipboard>
            )}
          </>
        )}

        {!hasAddressOrCoordinates && (
          <ListItem disablePadding>
            <ListItemButton disabled>
              <ListItemIcon>
                <LocationDisabledOutlined color="primary" />
              </ListItemIcon>
              <ListItemText primary={t('locationNotAvailable')} />
            </ListItemButton>
          </ListItem>
        )}

        {entranceText && (
          <CopyToClipboard text={entranceText} placement="bottom-end" onCopy={handleEntranceCopy}>
            <ListItem disablePadding secondaryAction={<DirectionsAction point={cave.entrance} label={t('directionsToEntrance')} />}>
              <ConditionalWrapper
                condition={!isSmall}
                wrapper={(children) => (
                  <Tooltip title={t('copyEntranceCoordinates')} slotProps={underCopyIcon(() => entranceCopyRef.current)} open={entranceTooltipOpen} onOpen={handleEntranceTooltipOpen} onClose={handleEntranceTooltipClose}>
                    {children}
                  </Tooltip>
                )}
              >
                <ListItemButton>
                  <ListItemIcon>
                    <FenceRounded color="primary" />
                  </ListItemIcon>
                  <ListItemText primary={entranceText} />
                  <ListItemIcon ref={entranceCopyRef} className="oc-icon-copy-container">
                    <ContentCopy className="oc-icon-copy" style={{ fontSize: '1.125rem' }} />
                  </ListItemIcon>
                </ListItemButton>
              </ConditionalWrapper>
            </ListItem>
          </CopyToClipboard>
        )}

        {keysTexts &&
          keysTexts.map((keyText, index) => (
            <CopyToClipboard key={keyText} text={keyText} placement="bottom-end" onCopy={handleKeyCoordinatesCopy}>
              <ListItem disablePadding secondaryAction={<DirectionsAction point={cave.keys[index]} label={t('directionsToKey')} />}>
                <ConditionalWrapper
                  condition={!isSmall}
                  wrapper={(children) => (
                    <Tooltip title={t('copyCoordinates')} slotProps={underCopyIcon(() => keyCopyRefs.current[index])} open={keyCoordinatesTooltipOpen} onOpen={handleKeyCoordinatesTooltipOpen} onClose={handleKeyCoordinatesTooltipClose}>
                      {children}
                    </Tooltip>
                  )}
                >
                  <ListItemButton>
                    <ListItemIcon>
                      <KeyRounded color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={keyText} />
                    <ListItemIcon ref={(element) => (keyCopyRefs.current[index] = element)} className="oc-icon-copy-container">
                      <ContentCopy className="oc-icon-copy" style={{ fontSize: '1.125rem' }} />
                    </ListItemIcon>
                  </ListItemButton>
                </ConditionalWrapper>
              </ListItem>
            </CopyToClipboard>
          ))}
        {/* The cave's area, linked to its page (/areas/<slug>). */}
        {cave.area && slugify(cave.area) && (
          <ListItem disablePadding className="oc-results-copy-list--area">
            <ListItemButton component={RouterLink} to={`/areas/${slugify(cave.area)}`}>
              <ListItemIcon>
                <TerrainOutlined color="primary" />
              </ListItemIcon>
              <ListItemText primary={t('area', { area: cave.area })} />
            </ListItemButton>
          </ListItem>
        )}
      </List>

      {cave.sistemas && cave.sistemas.length > 0 && (
        <>
          <Divider />
          <SistemaHistory sistemaHistory={cave.sistemas} />
        </>
      )}

      <Divider />

      <Access cave={cave} />

      {cave.description && (
        <>
          <Divider />
          <div className="details-container details-text">
            <Markdown>{cave.description}</Markdown>
          </div>
        </>
      )}

      {cave.direction && (
        <>
          <Divider />
          <div className="details-container">
            <h2 className="h2">{t('directionsHeader')}</h2>
          </div>
          <div className="details-container details-text">
            <Markdown>{cave.direction}</Markdown>
          </div>
        </>
      )}

    </Box>
  )
}
