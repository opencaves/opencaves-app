// The build onUploaded.js reads the panoramas' XMP with (the full one).
import exifr from 'exifr/dist/full.esm.mjs'

// The tags a photo's record uses (onUploaded.js), read as they're stored:
// values not revived, so the dates are the camera's own strings (exifr would
// read them in the server's time zone) and the orientation its number.
const PICK = ['DateTimeOriginal', 'ModifyDate', 'ImageWidth', 'ImageHeight', 'Orientation', 'GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef', 'GPSAltitude']

// Date.UTC of a date's and a time's parts, in seconds.
function utcSeconds([year, month, day], [hours, minutes, seconds]) {
  return Date.UTC(year, month - 1, day, hours, minutes, seconds, 0) / 1000
}

// An EXIF date in seconds, its clock time taken as UTC (no time zone in
// EXIF): "YYYY:MM:DD hh:mm:ss", or "YYYY-MM-DDThh:mm:ss+hh:mm" (its offset
// applied) that some cameras write; anything else, as it is.
function exifDate(value) {
  if (typeof value !== 'string') return value
  const toNumbers = (parts) => parts.map((part) => parseInt(part, 10))
  let timestamp
  if (value.length === 25 && value.charAt(10) === 'T') {
    const [offsetHours, offsetMinutes] = toNumbers(value.substr(19, 6).split(':'))
    timestamp = utcSeconds(toNumbers(value.substr(0, 10).split('-')), toNumbers(value.substr(11, 8).split(':'))) - (offsetHours * 3600 + offsetMinutes * 60)
  } else if (value.length === 19 && value.charAt(4) === ':') {
    const [date, time] = value.split(' ')
    timestamp = utcSeconds(toNumbers(date.split(':')), toNumbers(time.split(':')))
  }
  return typeof timestamp === 'number' && !isNaN(timestamp) ? timestamp : value
}

// Degrees, minutes, seconds as signed degrees: positive for `positive`
// (N or E), negative otherwise (a missing reference included).
function degrees(dms, ref, positive) {
  if (!Array.isArray(dms)) return dms
  return (dms[0] + dms[1] / 60 + dms[2] / 3600) * (ref === positive ? 1 : -1)
}

/**
 * A JPEG's EXIF tags a photo's record uses, read with exifr in the shape
 * exif-parser gave them (which onUploaded.js used before): dates in seconds
 * (their clock time as UTC), GPS in signed degrees, the altitude as written
 * (its above/below sea level reference ignored).
 *
 * @param {Buffer} buffer - The file.
 * @returns {Promise<{DateTimeOriginal?: number, ModifyDate?: number, ImageWidth?: number, ImageHeight?: number, Orientation?: number, GPSLatitude?: number, GPSLongitude?: number, GPSAltitude?: number}>} No tags: an empty object.
 * @throws {Error} When the file can't be read.
 */
export async function readExifTags(buffer) {
  const raw = await exifr.parse(buffer, { pick: PICK, tiff: true, ifd0: true, exif: true, gps: true, ifd1: false, interop: false, xmp: false, translateValues: false, reviveValues: false })
  if (!raw) return {}
  const { GPSLatitudeRef, GPSLongitudeRef, ...tags } = raw
  if (tags.DateTimeOriginal) tags.DateTimeOriginal = exifDate(tags.DateTimeOriginal)
  if (tags.ModifyDate) tags.ModifyDate = exifDate(tags.ModifyDate)
  if (tags.GPSLatitude) tags.GPSLatitude = degrees(tags.GPSLatitude, GPSLatitudeRef, 'N')
  if (tags.GPSLongitude) tags.GPSLongitude = degrees(tags.GPSLongitude, GPSLongitudeRef, 'E')
  return tags
}
