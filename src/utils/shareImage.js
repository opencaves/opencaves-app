import { SHARE_DEFAULT_IMAGE } from '@/config/app.js'

/**
 * A cave's or a system's share image (og:image) - its shareImage field, made
 * by the server (functions/js/share/shareImages.js): its cover photo or its
 * map card - with its alt text, else the site's own image. As the server's
 * pages give it (functions/js/seo/shared.js' shareImageOf), in the app's
 * language.
 *
 * @param {{shareImage?: {kind: string, url: string, width: number, height: number}}|null|undefined} record
 * @param {string} name - What it shows: the cave's name, the system's title.
 * @param {(key: string, options?: object) => string} t - The `seo` namespace's.
 * @returns {{url: string, width: number, height: number, alt: string}}
 */
export function shareImageOf(record, name, t) {
  const image = record?.shareImage
  if (!image?.url) return defaultShareImage(t)
  return { url: image.url, width: image.width, height: image.height, alt: t(image.kind === 'photo' ? 'shareImageAltPhoto' : 'shareImageAltMap', { name }) }
}

/**
 * The site's own share image (public/og-image.png), its alt text translated.
 *
 * @param {(key: string, options?: object) => string} t - The `seo` namespace's.
 * @returns {{url: string, width: number, height: number, alt: string}}
 */
export function defaultShareImage(t) {
  return { ...SHARE_DEFAULT_IMAGE, alt: t('shareImageAltDefault') }
}
