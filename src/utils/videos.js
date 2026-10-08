// A YouTube video's still thumbnail, or null for another site's video
// (Vimeo's and Facebook's need their scripts). size: 'mqdefault' (16:9, 320px
// wide) or 'hqdefault' (480px, 4:3 with the video letterboxed - cropped to
// 16:9 it's the sharper one).
export function youtubeThumbnail(url, size = 'mqdefault') {
  const id = String(url).match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/)?.[1]
  return id ? `https://i.ytimg.com/vi/${id}/${size}.jpg` : null
}

// The site a video link is on, by name (shown on a video without a
// thumbnail).
export function videoSiteName(url) {
  try {
    const host = new URL(String(url).trim()).hostname
    if (/(^|\.)vimeo\.com$/.test(host)) return 'Vimeo'
    if (/(^|\.)(facebook\.com|fb\.watch)$/.test(host)) return 'Facebook'
    if (/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(host)) return 'YouTube'
  } catch {
    // Not a link.
  }
  return ''
}
