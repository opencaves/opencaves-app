import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { Box, Divider, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip } from '@mui/material'
import ContentCopy from '@mui/icons-material/ContentCopyRounded'
import DirectionsRounded from '@mui/icons-material/DirectionsRounded'
import LocationOnRounded from '@mui/icons-material/LocationOnRounded'
import MyLocationRounded from '@mui/icons-material/MyLocationRounded'
import LocationDisabledRounded from '@mui/icons-material/LocationDisabledRounded'
import LoginRounded from '@mui/icons-material/LoginRounded'
import LocalParkingRounded from '@mui/icons-material/LocalParkingRounded'
import KeyRounded from '@mui/icons-material/KeyRounded'
import TerrainRounded from '@mui/icons-material/TerrainRounded'
import { Link as RouterLink } from 'react-router-dom'
import Markdown from '@/components/Markdown/Markdown.jsx'
import TextSource from '@/components/TextSource.jsx'
import ConditionalWrapper from '@/components/utils/ConditionalWrapper.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import { openDirections } from '@/utils/directions.js'
import { CoordinateRow, useCopiedConfirmation } from '@/components/CoordinateCopyList.jsx'
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
        <DirectionsRounded />
      </IconButton>
    </Tooltip>
  )
}

export default function CurrentCaveDetailsContent({ cave }) {
  const { t } = useTranslation('resultPane')

  const isSmall = useSmall()

  const [addressTooltipOpen, setAddressTooltipOpen] = useState(false)
  // Each line's copy icon: its "Copy …" tooltip is centred under it, not
  // under the whole line, and as low as the Directions button's tooltip (the
  // icon's left and width, the button's top and height).
  const addressCopyRef = useRef(null)
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

  let hasAddressOrCoordinates = false
  let address, addressText, coordinatesText, coordinatesTextCopy, keysTexts, entranceText, parkingText

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

  if (cave.parking) {
    parkingText = `${cave.parking.latitude}, ${cave.parking.longitude}`
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

  // "Copied to clipboard" (Android says it itself).
  const confirmCopied = useCopiedConfirmation()

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
                      <Tooltip describeChild title={t('copyAddress')} slotProps={underCopyIcon(() => addressCopyRef.current)} open={addressTooltipOpen} onOpen={handleAddressTooltipOpen} onClose={handleAddressTooltipClose}>
                        {children}
                      </Tooltip>
                    )}
                  >
                    <ListItemButton>
                      <ListItemIcon>
                        <LocationOnRounded color="primary" />
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

            {coordinatesText && <CoordinateRow icon={<MyLocationRounded color="primary" />} text={coordinatesText} copyText={coordinatesTextCopy} copyLabel={t('copyCoordinates')} point={cave.location} directionsLabel={t('directionsToCave')} onCopied={confirmCopied} tooltip={!isSmall} />}
          </>
        )}

        {!hasAddressOrCoordinates && (
          <ListItem disablePadding>
            <ListItemButton disabled>
              <ListItemIcon>
                <LocationDisabledRounded color="primary" />
              </ListItemIcon>
              <ListItemText primary={t('locationNotAvailable')} />
            </ListItemButton>
          </ListItem>
        )}

        {parkingText && <CoordinateRow icon={<LocalParkingRounded color="primary" />} text={parkingText} copyText={parkingText} copyLabel={t('copyParkingCoordinates')} point={cave.parking} directionsLabel={t('directionsToParking')} onCopied={confirmCopied} tooltip={!isSmall} />}

        {entranceText && <CoordinateRow icon={<LoginRounded color="primary" />} text={entranceText} copyText={entranceText} copyLabel={t('copyEntranceCoordinates')} point={cave.entrance} directionsLabel={t('directionsToEntrance')} onCopied={confirmCopied} tooltip={!isSmall} />}

        {keysTexts &&
          keysTexts.map((keyText, index) => <CoordinateRow key={keyText} icon={<KeyRounded color="primary" />} text={keyText} copyText={keyText} copyLabel={t('copyCoordinates')} point={cave.keys[index]} directionsLabel={t('directionsToKey')} onCopied={confirmCopied} tooltip={!isSmall} />)}
        {/* The cave's area, linked to its section of the cave list (/caves#<slug>). */}
        {cave.area && slugify(cave.area) && (
          <ListItem disablePadding className="oc-results-copy-list--area">
            <ListItemButton component={RouterLink} to={`/caves#${slugify(cave.area)}`}>
              <ListItemIcon>
                <TerrainRounded color="primary" />
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
            <TextSource record={cave} field="description" />
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
            <TextSource record={cave} field="direction" />
          </div>
        </>
      )}

    </Box>
  )
}
