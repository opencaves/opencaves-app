import { useEffect, useRef, useState } from 'react'
import { Link, useLoaderData } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Grid from '@mui/material/Unstable_Grid2'
import Scrollbars from '@/components/Scrollbars/Scrollbars'
import { Box, ButtonBase, Divider, Skeleton, Typography } from '@mui/material'
import { AddAPhotoOutlined } from '@mui/icons-material'
import { useAddMedias } from '@/components/MediaPane/AddMedias/useAddMedias'
import { getAssetList, getImageAssetUrl, useCaveAssetsList } from '@/models/CaveAsset'
import { useImage } from '@/hooks/useImage'
import { assetsListConfig } from '@/config/resultPane'
import { scrollbarStepFactor, scrollbarTrackHeight } from '@/config/app'

export function loadMediaList(caveId) {
  return getAssetList(caveId, false)
}

export default function MediaList({ caveId }) {
  const [mediaList, loading, error] = useCaveAssetsList(caveId)
  const [assetsList, setAssetsList] = useState(null)
  const { height: assetsListHeight, maxLength: assetsListMaxLength } = assetsListConfig
  const scrollbarsRef = useRef()
  // const { result } = CaveAsset.getAssetList(caveId)
  const { mediaList: initialMediaList } = useLoaderData()
  // const mediaList = { empty: true }

  const start = useRef(Date.now())

  function getColPosition(i) {
    const triplets = Math.ceil((i + 1) / 3) - 1
    const secondCol = i % 3 > 0 ? 1 : 0
    return (triplets * 2) + secondCol
  }

  useEffect(() => {
    const scrollbar = scrollbarsRef?.current

    function onWheel(event) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollbar.getValues()
      const width = scrollWidth - clientWidth
      const wheelDirection = event.wheelDeltaY < 0 ? 1 : -1

      if (
        // scrolling left
        (wheelDirection < 0 && Math.round(scrollLeft) <= 0)
        ||
        // scrolling right
        (wheelDirection > 0 && Math.round(scrollLeft) >= width)
      ) {
        return
      }

      const scrollStep = scrollbarStepFactor * wheelDirection
      const func = wheelDirection > 0 ? Math.min : Math.max
      const clampValue = wheelDirection > 0 ? width : 0
      const newScrollLeft = scrollLeft + scrollStep
      const clampedScrollLeft = func(clampValue, newScrollLeft)

      event.preventDefault()
      scrollbar.scrollLeft(clampedScrollLeft)
    }

    if (scrollbar) {
      scrollbar.container.addEventListener('wheel', onWheel)
    }

    return () => scrollbar?.container?.removeEventListener('wheel', onWheel)
  })

  useEffect(() => {
    console.log('##### [MediaList] loading time from useLoaderData: %s, %o', Date.now() - start.current, initialMediaList)
  }, [initialMediaList])

  useEffect(() => {
    console.log('##### [MediaList] loading time from useCaveAssetsList: %s, %o', Date.now() - start.current, mediaList)

    const list = []

    if (mediaList && !mediaList.empty) {
      const assetsListLength = Math.min(mediaList.size, assetsListMaxLength)
      const assetItems = []

      for (var i = 0; i < assetsListLength; i++) {
        assetItems.push({
          isMedia: true,
          item: mediaList.docs[i].data()
        })
      }

      assetItems.push({
        isMedia: false
      })

      const lastColIdx = getColPosition(assetItems.length - 1)

      function isLastCol(i) {
        return getColPosition(i) === lastColIdx
      }

      for (var i = 0; i < assetItems.length; i += 3) {
        list.push(
          <MediaListCol key={i} isLast={isLastCol(i)}>
            <Media asset={assetItems[i]} />
          </MediaListCol>
        )

        if (assetItems[i + 1]) {
          const colItems = [
            <MediaListCell key={1} height={assetsListHeight / 2} width={assetsListHeight / 2}>
              <Media asset={assetItems[i + 1]} size='half' />
            </MediaListCell>
          ]

          if (assetItems[i + 2]) {
            colItems.push(
              <MediaListCell key={2} position='bottom' height={assetsListHeight / 2} width={assetsListHeight / 2}>
                <Media asset={assetItems[i + 2]} size='half' />
              </MediaListCell>
            )
          }

          list.push(<MediaListCol key={i + 1} isLast={isLastCol(i + 1)} width='half'>{colItems}</MediaListCol>)
        }
      }
      setAssetsList(list)
    }
  }, [mediaList])

  return mediaList && !mediaList.empty && (
    <>
      <Box
      >
        <Scrollbars
          ref={scrollbarsRef}
          autoHide
          autoHeight
          autoHeightMax={assetsListHeight + 100}
          trackHorizontalProps={{
            style: {
              left: 'calc(var(--oc-pane-padding-inline) / 2)',
              right: 'calc(var(--oc-pane-padding-inline) / 2)',
              bottom: `calc((var(--oc-pane-padding-block) - ${scrollbarTrackHeight}px) / 2)`
            }
          }}
        >
          <Box
            px='var(--oc-pane-padding-inline)'
            pr='var(--oc-pane-padding-inline)'
            my='var(--oc-pane-padding-block)'
            width='fit-content'
          >
            <Grid
              container
              direction='row'
              flexWrap='nowrap'
              width='min-content'
              display='flex'
            >
              {assetsList}
            </Grid>
          </Box>
        </Scrollbars>
      </Box>
      <Divider />
    </>
  )
}

function Media({ asset, size = 'full' }) {
  const fullHeight = assetsListConfig.height
  const fullWidth = assetsListConfig.height * assetsListConfig.widthRatio
  const width = size === 'full' ? fullWidth : (fullWidth / 2) - (assetsListConfig.spacing / 2)
  const height = size === 'full' ? fullHeight : (fullHeight / 2) - (assetsListConfig.spacing / 2)

  if (!asset.isMedia) {
    return <AddMedias width={width} height={height} />
  }

  const media = asset.item

  // const assetUrl = getImageAssetUrl(asset.fullPath, { width: length, height: length })
  const assetUrl = media.url
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { src, status, error } = useImage(assetUrl)

  return status === 'loading' ? (
    <Skeleton variant='rounded' width={width} height={height} />
  ) : status === 'success' ? (
    <ButtonBase
      component={Link}
      to={`medias/${media.id}`}
    >
      <img
        src={src}
        alt=''
        style={{
          borderRadius: '.5rem',
          width,
          height,
          objectFit: 'cover'
        }}
      />
    </ButtonBase>
  ) : status === 'failed' ? (
    <Box
      width={width}
      height={height}
      sx={{
        borderRadius: '.5rem',
        backgroundColor: 'rgb(0 0 0 / 4.5%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'smaller',
        padding: 1,

      }}
    >
      {error}
    </Box>
  ) : null
}

function MediaListCol({ children, width = 'full', isLast = false, height = assetsListConfig.height, ...props }) {
  const defaultWidth = assetsListConfig.height * assetsListConfig.widthRatio
  const widths = {
    full: isLast ? defaultWidth : defaultWidth + assetsListConfig.spacing,
    half: isLast ? defaultWidth / 2 : (defaultWidth + assetsListConfig.spacing) / 2
  }

  return (
    <Grid
      {...props}
      container
      direction='column'
      flexWrap='nowrap'
      justifyContent='flex-start'
      alignItems='flex-start'
      minHeight={height}
      minWidth={widths[width]}
      position='relative'
    >
      {children}
    </Grid>
  )
}

function MediaListCell({ children, width = 'full', height = assetsListConfig.height, position = 'top', ...props }) {

  const widths = {
    full: assetsListConfig.height,
    half: assetsListConfig.height / 2
  }

  return (
    <Grid
      {...props}
      container
      direction='column'
      flexWrap='nowrap'
      justifyContent={width === 'full' ? 'center' : position === 'top' ? 'flex-start' : 'flex-end'}
      alignItems='flex-start'
      minHeight={height}
      minWidth={widths[width]}
      position='relative'
    >
      {children}
    </Grid>
  )
}

function AddMedias({ width, height }) {
  const { promptForMedias } = useAddMedias()
  const { t } = useTranslation('resultPane', { keyPrefix: 'addPictureBtn' })
  function getProp(which, theme) {
    if (which === 'color') {
      return theme.palette.mode === 'light' ? theme.palette.primary.dark : theme.palette.primary.light
    }
  }
  return (
    <ButtonBase
      sx={{
        borderRadius: '.5rem',
        backgroundColor: theme => `rgb(${theme.palette.primary.mainChannel} / ${theme.palette.mode === 'light' ? .1 : .08})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 1,
        width,
        height,
        opacity: .85,
        ':hover': {
          opacity: 1
        }

      }}
      onClick={promptForMedias}
    >
      <Grid
        container
        direction='column'
        alignItems='center'
        rowGap={.75}
      >
        <AddAPhotoOutlined fontSize='small' sx={{ color: theme => getProp('color', theme) }} />
        <Typography
          sx={{
            fontSize: '.875rem',
            color: theme => getProp('color', theme)
            // color: theme => theme.palette.getContrastText(theme.palette.primary.main)
          }}
        >
          {t('btn')}
        </Typography>
      </Grid>
    </ButtonBase>
  )
}