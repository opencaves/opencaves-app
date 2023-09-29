import * as path from 'path'
import * as logs from './logs.js'
import config from './config.js'
import { supportedContentTypes } from './resize-image.js'
import { startsWithArray } from './util.js'


export function shouldResize(object) {
  const { contentType } = object // This is the image MIME type


  // const tmpFilePath = path.resolve(path.sep, path.dirname(object.name)) // Absolute path to dirname
  const tmpFilePath = `/${path.dirname(object.name).replaceAll(path.sep, '/')}` // Absolute path to dirname
  console.log('[=========================] %o, %s', contentType, tmpFilePath)
  if (!contentType) {
    logs.noContentType()
    return false
  }

  if (!contentType.startsWith('image/')) {
    logs.contentTypeInvalid(contentType)
    return false
  }

  if (object.contentEncoding === 'gzip') {
    logs.gzipContentEncoding()
    return false
  }

  if (!supportedContentTypes.includes(contentType)) {
    logs.unsupportedType(supportedContentTypes, contentType)
    return false
  }

  if (config.includePathList &&
    !startsWithArray(config.includePathList, tmpFilePath)) {
    logs.imageOutsideOfPaths(config.includePathList, tmpFilePath)
    return false
  }

  if (config.excludePathList &&
    startsWithArray(config.excludePathList, tmpFilePath)) {
    logs.imageInsideOfExcludedPaths(config.excludePathList, tmpFilePath)
    return false
  }

  if (object.metadata && object.metadata.resizedImage === 'true') {
    logs.imageAlreadyResized()
    return false
  }
  if (object.metadata && object.metadata.resizeFailed) {
    logs.imageFailedAttempt()
    return false
  }

  return true
}
