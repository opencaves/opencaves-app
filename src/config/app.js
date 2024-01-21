import { assetsListConfig, coverImageHeightRatio } from './resultPane'

export const appName = 'OpenCaves'
export const appTitle = 'Open Caves' // For use in the page <title> and in the app title bar
export const paneWidth = 400
export const paneOpenThreshold = .7
export const paneBreakpoints = [.33, 1]
export const resultPaneMinHeight = 300
export const snackbarAutoHideDuration = 6000
export const scrollbarTrackHeight = 8
export const scrollbarStepFactor = 38
export const thumbnailFormats = ['webp']
export const thumbnailFolder = 'thumbnails'
export const caveAssetsSizes = {
  coverImage: `${paneWidth}x${Math.round(paneWidth * coverImageHeightRatio)}`,
  resultThumbnail: `${Math.round(assetsListConfig.widthRatio * assetsListConfig.height)}x${assetsListConfig.height}`,
  mediaThumbnail: '400x800'
}

const magnificationFactor = 1.5022

export const imageSizes = {
  coverImage: {
    width: Math.round(400 * magnificationFactor),
    height: Math.round(225 * magnificationFactor),
    // width: 400,
    // height: 225,
    fit: 'cover'
  },
  resultThumbnail: {
    width: Math.round(240 * magnificationFactor),
    height: Math.round(300 * magnificationFactor),
    fit: 'outside'
  },
  mediaThumbnail: {
    width: 400,
    height: 800,
    fit: 'inside'
  },
  '1024': {
    width: 1024,
    fit: 'outside'
  },
  '1536': {
    width: 1536,
    fit: 'outside'
  },
  '4k': {
    width: 3840,
    fit: 'outside'
  }
}