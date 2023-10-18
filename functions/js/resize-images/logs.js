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

import { logger } from 'firebase-functions'
import config from './config.js'

export const complete = () => {
  logger.log('Completed execution of function resize image')
}

export const noContentType = () => {
  logger.log('File has no Content-Type, no processing is required')
}

export const gzipContentEncoding = () => {
  logger.log('Images encoded with \'gzip\' are not supported by this function resize image')
}

export const contentTypeInvalid = contentType => {
  logger.log(
    `File of type '${contentType}' is not an image, no processing is required`
  )
}

export const unsupportedType = (unsupportedTypes, contentType) => {
  logger.log(
    `Image type '${contentType}' is not supported, here are the supported file types: ${unsupportedTypes.join(
      ', '
    )}`
  )
}

export const error = err => {
  logger.error('Error when resizing image', err)
}

export const errorDeleting = err => {
  logger.warn('Error when deleting files', err)
}

export const failed = () => {
  logger.error('Failed execution of function resize image')
}

export const imageAlreadyResized = () => {
  logger.log('File is already a resized image, no processing is required')
}

export const imageFailedAttempt = () => {
  logger.log(
    'File is a copy of an image which failed to resize, no processing is required'
  )
}

export const imageOutsideOfPaths = (absolutePaths, imagePath) => {
  logger.log(
    `Image path '${imagePath}' is not supported, these are the supported absolute paths: ${absolutePaths.join(
      ', '
    )}`
  )
}

export const imageInsideOfExcludedPaths = (absolutePaths, imagePath) => {
  logger.log(
    `Image path '${imagePath}' is not supported, these are the not supported absolute paths: ${absolutePaths.join(
      ', '
    )}`
  )
}

export const imageDownloaded = (remotePath, localPath) => {
  logger.log(`Downloaded image file: '${remotePath}' to '${localPath}'`)
}

export const imageDownloading = path => {
  logger.log(`Downloading image file: '${path}'`)
}

export const imageConverting = (originalImageType, imageType) => {
  logger.log(
    `Converting image from type, ${originalImageType}, to type ${imageType}.`
  )
}

export const imageConverted = imageType => {
  logger.log(`Converted image to ${imageType}`)
}

export const imageResized = path => {
  logger.log(`Resized image created at '${path}'`)
}

export const imageResizing = (path, size) => {
  logger.log(`Resizing image at path '${path}' to size: ${size}`)
}

export const imageUploaded = path => {
  logger.log(`Uploaded resized image to '${path}'`)
}

export const imageUploading = path => {
  logger.log(`Uploading resized image to '${path}'`)
}

export const init = () => {
  logger.log('Initializing function resize image with configuration', config)
}

export const start = () => {
  logger.log('Started execution of function resize image with configuration', config)
}

export const tempDirectoryCreated = directory => {
  logger.log(`Created temporary directory: '${directory}'`)
}

export const tempDirectoryCreating = directory => {
  logger.log(`Creating temporary directory: '${directory}'`)
}

export const tempOriginalFileDeleted = path => {
  logger.log(`Deleted temporary original file: '${path}'`)
}

export const tempOriginalFileDeleting = path => {
  logger.log(`Deleting temporary original file: '${path}'`)
}

export const tempResizedFileDeleted = path => {
  logger.log(`Deleted temporary resized file: '${path}'`)
}

export const tempResizedFileDeleting = path => {
  logger.log(`Deleting temporary resized file: '${path}'`)
}

export const remoteFileDeleted = path => {
  logger.log(`Deleted original file from storage bucket: '${path}'`)
}

export const remoteFileDeleting = path => {
  logger.log(`Deleting original file from storage bucket: '${path}'`)
}

export const errorOutputOptionsParse = err => {
  logger.error(
    `Error while parsing "Output options for selected format". Parameter will be ignored`,
    err
  )
}

export const startBackfill = () => {
  logger.log('Starting backfill job. Checking for existing images to resize.')
}

export const continueBackfill = fileName => {
  logger.log(`Checking if '${fileName}' needs to resized`)
}

export const backfillComplete = (success, failures) => {
  logger.log(
    `Finished backfill. Successfully resized ${success} images. Failed to resize ${failures} images.`
  )
}
export const failedImageUploading = path => {
  logger.log(`Uploading failed image to the failed images directory: '${path}'`)
}

export const failedImageUploaded = path => {
  logger.log(`Uploaded failed image to the failed images directory: '${path}'`)
}
