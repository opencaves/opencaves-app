import { useTranslation } from 'react-i18next'
import ShareRounded from '@mui/icons-material/ShareRounded'
import DownloadRounded from '@mui/icons-material/DownloadRounded'
import FlagRounded from '@mui/icons-material/FlagRounded'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { openFeedback } from '@/utils/feedback.js'

/**
 * A media action, as a menu draws it (CardOptionsMenu's actions, or a
 * Menu's items: PhotoActionItems.jsx's mediaMenuItems).
 *
 * @typedef {object} MediaAction
 * @property {string} key
 * @property {string} label
 * @property {import('react').ReactNode} icon
 * @property {() => void} onClick
 * @property {boolean} [divider] - A line under it (before the next group).
 */

/**
 * The actions everyone has on a photo, a survey map or a video, the same in
 * each of their ⋮ menus: Share (the system's share sheet, else the link
 * copied) when it has a link, Download (its file, when there's one and no
 * button for it already) and Report this… (the Send feedback form about it:
 * a visitor is asked to sign in first). A builder, called for each item (a
 * list's, in a loop where a hook can't be).
 *
 * @returns {(media: { kind: 'photo'|'map'|'video', shareUrl?: string, download?: { url: string, fileName: string }, reportPage: string, onDone?: () => void }) => MediaAction[]} The
 *   actions for one item: `shareUrl` its link (none: no Share), `download` its file (none: no
 *   Download), `reportPage` what a report is about (its address, or its link), `onDone` called as an
 *   action is chosen (closes the menu).
 */
export function useMediaActionsFor() {
  const { t } = useTranslation('mediaPane')
  const [openSnackbar] = useSnackbar()

  return ({ kind, shareUrl, download, reportPage, onDone }) => {
    async function share() {
      onDone?.()
      try {
        if (navigator.share) {
          await navigator.share({ title: t('share.title', { title: document.title }), url: shareUrl })
          return
        }
        await navigator.clipboard.writeText(shareUrl)
        openSnackbar(t('menu.linkCopied'), { severity: 'success' })
      } catch (error) {
        // Closing the share sheet isn't a failure.
        if (error?.name !== 'AbortError') openSnackbar(t('menu.shareFail'))
      }
    }

    // Fetched, then saved: a link's download attribute doesn't work for a
    // file on another origin (the bucket; storage.cors.json allows the fetch).
    async function save() {
      onDone?.()
      try {
        const response = await fetch(download.url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const href = URL.createObjectURL(await response.blob())
        const link = document.createElement('a')
        link.href = href
        link.download = download.fileName
        link.click()
        setTimeout(() => URL.revokeObjectURL(href), 1000)
      } catch (error) {
        console.error(error)
        openSnackbar(t('menu.downloadFail'))
      }
    }

    function report() {
      onDone?.()
      openFeedback('misleading', { page: reportPage })
    }

    return [
      shareUrl && { key: 'share', label: t('menu.share'), icon: <ShareRounded fontSize="small" />, onClick: share },
      download?.url && { key: 'download', label: t('menu.download'), icon: <DownloadRounded fontSize="small" />, onClick: save },
      { key: 'report', label: t(`menu.report.${kind}`), icon: <FlagRounded fontSize="small" />, onClick: report },
    ].filter(Boolean)
  }
}

/**
 * Everyone's actions, then the others (edit, delete...), a line between the
 * two groups when both are there.
 *
 * @param {MediaAction[]} mediaActions - {@link useMediaActionsFor}'s.
 * @param {object[]} others - The menu's own actions, for those allowed.
 * @returns {object[]}
 */
export function withOthers(mediaActions, others) {
  if (!others.length) return mediaActions
  return [...mediaActions.slice(0, -1), { ...mediaActions.at(-1), divider: true }, ...others]
}

/**
 * A file's name when downloaded: its kind and id, its type's extension - not
 * the uploaded file's name, which isn't public (cavesAssetsPrivate).
 *
 * @param {string} prefix - "opencaves", "opencaves-map".
 * @param {string} id
 * @param {string} [contentType]
 * @returns {string}
 */
export function downloadName(prefix, id, contentType) {
  const subtype = (contentType || 'image/jpeg').split('/')[1] || 'jpeg'
  const extension = subtype.replace('jpeg', 'jpg').replace('svg+xml', 'svg')
  return `${prefix}-${id}.${extension}`
}
