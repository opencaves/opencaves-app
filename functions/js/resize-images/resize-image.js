import os from 'os'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

import { v4 as uuid } from 'uuid'

import config from './config.js'
import * as logs from './logs.js'

export function resize(file, { width, height, ...options }) {
  // let height, width
  // if (size.indexOf(',') !== -1) {
  //   [width, height] = size.split(',')
  // } else if (size.indexOf('x') !== -1) {
  //   [width, height] = size.split('x')
  // } else {
  //   throw new Error('height and width are not delimited by a \',\' or a \'x\'')
  // }

  // failOn 'none': tolerate slightly malformed JPEGs ("Invalid SOS parameters")
  // that browsers display fine. sharp 0.35 ignores the older failOnError option.
  // rotate(): the camera's EXIF orientation applied - a phone saves many
  // photos sideways or upside down with a tag saying how to turn them, and the
  // resized copies don't keep that tag.
  return sharp(file, { failOn: 'none', animated: config.animated })
    .rotate()
    .resize(width, height, options)
    .toBuffer()
}

// The photo's size as shown: orientations 5-8 turn it a quarter.
export async function shownSize(file) {
  const { width, height, orientation } = await sharp(file, { failOn: 'none' }).metadata()
  return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height }
}

export function convertType(buffer, format) {
  const defaultOutputOptions = {
    jpeg: {},
    jpg: {},
    png: {},
    webp: {},
    tiff: {},
    tif: {},
    avif: {}
  }

  const outputOptions = {
    ...defaultOutputOptions,
    ...config.outputOptions
  }

  const { jpeg, jpg, png, webp, tiff, tif, avif } = outputOptions

  if (format === 'jpeg') {
    return sharp(buffer)
      .jpeg(jpeg)
      .toBuffer()
  }

  if (format === 'jpg') {
    return sharp(buffer)
      .jpeg(jpg)
      .toBuffer()
  }

  if (format === 'png') {
    return sharp(buffer)
      .png(png)
      .toBuffer()
  }

  if (format === 'webp') {
    return sharp(buffer, { animated: config.animated })
      .webp(webp)
      .toBuffer()
  }

  if (format === 'tif') {
    return sharp(buffer)
      .tiff(tif)
      .toBuffer()
  }

  if (format === 'tiff') {
    return sharp(buffer)
      .tiff(tiff)
      .toBuffer()
  }

  if (format === 'gif') {
    return sharp(buffer, { animated: config.animated })
      .gif()
      .toBuffer()
  }

  if (format === 'avif') {
    return sharp(buffer)
      .avif(avif)
      .toBuffer()
  }

  return buffer
}

/**
 * Supported file types
 */
export const supportedContentTypes = [
  'image/jpg',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/webp',
  'image/gif',
  'image/avif'
]

export const supportedImageContentTypeMap = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tif: 'image/tif',
  tiff: 'image/tiff',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  jfif: 'image/jpeg'
}

export const modifyImage = async ({
  bucket,
  originalFile,
  parsedPath,
  contentType,
  size,
  sizeOptions,
  objectMetadata,
  format
}) => {
  const {
    ext: fileExtension,
    dir: fileDir,
    name: fileNameWithoutExtension
  } = parsedPath
  const shouldFormatImage = format !== 'false'
  const imageContentType = shouldFormatImage
    ? supportedImageContentTypeMap[format]
    : contentType

  const modifiedFileName = `${fileNameWithoutExtension}_${size}.${format}`

  // Path where modified image will be uploaded to in Storage.
  const modifiedFilePath = path.normalize(
    config.resizedImagesPath
      ? path.posix.join(fileDir, config.resizedImagesPath, modifiedFileName)
      : path.posix.join(fileDir, modifiedFileName)
  ).replaceAll('\\', '/')

  let modifiedFile

  try {
    modifiedFile = path.join(os.tmpdir(), uuid())

    // filename\*=utf-8''  selects any string match the filename notation.
    // [^;\s]+ searches any following string until either a space or semi-colon.
    const contentDisposition = objectMetadata && objectMetadata.contentDisposition ? objectMetadata.contentDisposition.replace(
      /(filename\*=utf-8''[^;\s]+)/,
      `filename*=utf-8''${modifiedFileName}`
    )
      : ''

    // Cloud Storage files.
    const metadata = {
      contentDisposition,
      contentEncoding: objectMetadata.contentEncoding,
      contentLanguage: objectMetadata.contentLanguage,
      contentType: imageContentType,
      metadata: objectMetadata.metadata ? { ...objectMetadata.metadata } : {}
    }
    metadata.metadata.resizedImage = true
    if (config.cacheControlHeader) {
      metadata.cacheControl = config.cacheControlHeader
    } else {
      metadata.cacheControl = objectMetadata.cacheControl
    }

    // If the original image has a download token, add a
    // new token to the image being resized #323
    if (metadata.metadata.firebaseStorageDownloadTokens) {
      metadata.metadata.firebaseStorageDownloadTokens = uuid()
    }

    // Generate a resized image buffer using Sharp.
    logs.imageResizing(modifiedFile, size)
    let modifiedImageBuffer = await resize(originalFile, sizeOptions)
    logs.imageResized(modifiedFile)

    // Generate a converted image type buffer using Sharp.

    if (shouldFormatImage) {
      logs.imageConverting(fileExtension, format)
      modifiedImageBuffer = await convertType(modifiedImageBuffer, format)
      logs.imageConverted(format)
    }

    // The buffer is the final image: written as is (sharp's toFile() encoded
    // it again, at its default quality, making the copies 15-20% bigger).
    fs.writeFileSync(modifiedFile, modifiedImageBuffer)

    // Uploading the modified image.
    logs.imageUploading(modifiedFilePath)
    const uploadResponse = await bucket.upload(modifiedFile, {
      destination: modifiedFilePath,
      metadata
    })
    logs.imageUploaded(modifiedFile)

    // Make uploaded image public.
    if (config.makePublic) {
      await uploadResponse[0].makePublic()
    }

    return { size, outputFilePath: modifiedFilePath, success: true }
  } catch (err) {
    logs.error(err)
    return { size, outputFilePath: modifiedFilePath, success: false }
  } finally {
    try {
      // Make sure the local resized file is cleaned up to free up disk space.
      if (modifiedFile) {
        logs.tempResizedFileDeleting(modifiedFilePath)
        fs.unlinkSync(modifiedFile)
        logs.tempResizedFileDeleted(modifiedFilePath)
      }
    } catch (err) {
      logs.errorDeleting(err)
    }
  }
}
