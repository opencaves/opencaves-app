/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export let deleteImage

  ; (function (deleteImage) {
    deleteImage[(deleteImage['always'] = 0)] = 'always'
    deleteImage[(deleteImage['never'] = 1)] = 'never'
    deleteImage[(deleteImage['onSuccess'] = 2)] = 'onSuccess'
  })(deleteImage || (deleteImage = {}))

function deleteOriginalFile(deleteType) {
  switch (deleteType) {
    case 'true':
      return deleteImage.always
    case 'false':
      return deleteImage.never
    default:
      return deleteImage.onSuccess
  }
}

function paramToArray(param) {
  return typeof param === 'string' ? param.split(',') : undefined
}

// const config = {
//   bucket: process.env.IMG_BUCKET,
//   cacheControlHeader: process.env.CACHE_CONTROL_HEADER,
//   doBackfill: process.env.DO_BACKFILL === 'true',
//   imageSizes: process.env.IMG_SIZES.split(','),
//   makePublic: process.env.MAKE_PUBLIC === 'true',
//   resizedImagesPath: process.env.RESIZED_IMAGES_PATH,
//   includePathList: paramToArray(process.env.INCLUDE_PATH_LIST),
//   excludePathList: paramToArray(process.env.EXCLUDE_PATH_LIST),
//   failedImagesPath: process.env.FAILED_IMAGES_PATH,
//   deleteOriginalFile: deleteOriginalFile(process.env.DELETE_ORIGINAL_FILE),
//   imageTypes: paramToArray(process.env.IMAGE_TYPE),
//   outputOptions: process.env.OUTPUT_OPTIONS,
//   animated: process.env.IS_ANIMATED === 'true' || undefined ? true : false,
//   location: process.env.LOCATION
// }

const magnificationFactor = 1.5022

const config = {
  bucket: 'opencaves.appspot.com',
  cacheControlHeader: 'public, max-age=31536000, immutable',
  doBackfill: true,
  imageSizes: {
    coverImage: {
      width: Math.round(400 * magnificationFactor),
      height: Math.round(225 * magnificationFactor),
      // width: 400,
      // height: 225,
      fit: 'cover'
    },
    resultPaneThumbnail: {
      width: 400,
      height: 800,
      fit: 'inside'
    },
    mediaPaneThumbnail: {
      width: 400,
      height: 800,
      fit: 'inside'
    },
  },
  makePublic: true,
  resizedImagesPath: '../thumbnails',
  includePathList: paramToArray('/caves/*/images'),
  excludePathList: paramToArray(undefined),
  failedImagesPath: 'failed',
  deleteOriginalFile: deleteOriginalFile('false'),
  imageTypes: paramToArray('webp,avif'),
  // outputOptions: undefined,
  outputOptions: {
    webp: {
      quality: 50,
      effort: 4,
      smartSubsample: true,
      preset: 'photo'
    }
  },
  animated: true,
  location: 'northamerica-northeast1'
}

export default config
