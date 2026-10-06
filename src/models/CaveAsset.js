import { useMemo } from 'react'
import { collection, deleteField, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { ref, uploadBytesResumable } from 'firebase/storage'
import getId from 'unique-push-id'
import { builder } from '@invertase/image-processing-api'
import { useCollection } from 'react-firebase-hooks/firestore'
import { breakpoints } from '@/theme/Theme.jsx'
import { auth, db, functions, storage } from '@/config/firebase.js'
import { isTrashed, withoutTrashed } from '@/utils/trash.js'
import { FIREBASE_CONFIG } from '@/config/firebase.config.js'
import { IMAGE_SIZES, PANE_WIDTH, THUMBNAIL_FOLDER, THUMBNAIL_FORMATS, VIEW_THUMBNAIL_SIZES } from '@/config/app.js'
import { httpsCallable } from 'firebase/functions'
import { assertOnline } from '@/utils/assertOnline.js'

const CAVES_ASSETS_COLL_NAME = 'cavesAssets'

// A cave's photo list with its cover first, the others kept in their order.
function coverFirst(list) {
  if (!list) return list
  const docs = [...list.docs].sort((a, b) => (b.get('isCover') ? 1 : 0) - (a.get('isCover') ? 1 : 0))
  return { ...list, docs, forEach: (callback, thisArg) => docs.forEach(callback, thisArg) }
}
const COLL = collection(db, CAVES_ASSETS_COLL_NAME)

export default class CaveAsset {

  #url

  static async getById(assetId) {
    return new Promise(async (resolve, reject) => {
      try {

        const assetRef = doc(db, CAVES_ASSETS_COLL_NAME, assetId).withConverter(converter)
        const assetSnap = await getDoc(assetRef)

        if (!assetSnap.exists()) {
          return reject(`Can't get asset ${assetId}: it doesn't exist.`)
        }

        resolve(assetSnap.data())
      } catch (error) {
        reject(error)
      }
    })
  }

  // To the trash (admins): kept, with who moved it there and when, so it can
  // be restored from Audits > Trash; every reader skips it (utils/trash.js).
  static async deleteById(assetId) {
    const docRef = doc(db, CAVES_ASSETS_COLL_NAME, assetId)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      throw new Error(`Can't delete asset ${assetId}: it doesn't exist.`)
    }

    await updateDoc(docRef, { deletedAt: serverTimestamp(), deletedBy: auth.currentUser?.uid ?? null })
  }

  // Back from the trash.
  static async restoreById(assetId) {
    await updateDoc(doc(db, CAVES_ASSETS_COLL_NAME, assetId), { deletedAt: deleteField(), deletedBy: deleteField() })
  }

  // The photos in the trash, most recently deleted first (Audits > Trash).
  static async getTrashed() {
    const { docs } = await getDocs(query(COLL, where('deletedAt', '!=', null), orderBy('deletedAt', 'desc')).withConverter(converter))
    return docs.map((d) => d.data())
  }

  // One-shot reads (no listener) used by the offline downloads.
  static async getImages(caveId) {
    const { docs } = await getDocs(query(COLL, where('caveId', '==', caveId), where('type', '==', 'image')).withConverter(converter))
    return docs.filter((d) => !isTrashed(d)).map((d) => d.data())
  }

  static async getAllCoverImages() {
    const { docs } = await getDocs(query(COLL, where('type', '==', 'image'), where('isCover', '==', true)).withConverter(converter))
    return docs.filter((d) => !isTrashed(d)).map((d) => d.data())
  }

  static async getAssetList(caveId, useSnapshot = true) {
    const q = query(COLL, where('caveId', '==', caveId), where('type', '==', 'image')).withConverter(converter)

    const { docs, empty, size } = coverFirst(withoutTrashed(await getDocs(q)))
    const assetList = { docs, empty, size }

    if (useSnapshot) {
      onSnapshot(q, (snapshot) => {
        const { docs, empty, size } = coverFirst(withoutTrashed(snapshot))
        assetList.docs = docs
        assetList.empty = empty
        assetList.size = size
      })
    }

    return assetList
  }

  static async getCoverImage(caveId, useSnapshot = true) {
    return new Promise(async (resolve, reject) => {
      try {
        const q = query(COLL, where('caveId', '==', caveId), where('type', '==', 'image'), where('isCover', '==', true)).withConverter(converter)

        if (useSnapshot) {
          const result = { data: null }
          onSnapshot(q, snapshot => {
            const querySnapshot = withoutTrashed(snapshot)
            if (querySnapshot.empty) {
              result.data = null
              return
            }

            result.data = querySnapshot.docs[0].data()

          })

          return resolve(result)
        }

        const querySnapshot = withoutTrashed(await getDocs(q))

        if (querySnapshot.empty) {
          return resolve(null)
        }

        resolve(querySnapshot.docs[0])

      } catch (error) {
        reject(error)
      }
    })
  }

  constructor({ caveId, userId, isCover = false, type = 'image' } = {}) {
    this.id = getId()
    this.caveId = caveId
    this.userId = userId
    this.isCover = isCover
    this.type = type
  }

  toObject() {
    return {
      ...this
    }
  }

  // The original upload, through the Firebase Storage API (public by the
  // storage rules): unlike the thumbnails, originals aren't public objects,
  // so their storage.googleapis.com URL answers 403.
  get url() {
    const host = window.location.hostname === 'localhost' ? 'http://localhost:9199' : 'https://firebasestorage.googleapis.com'
    return `${host}/v0/b/${FIREBASE_CONFIG.storageBucket}/o/${encodeURIComponent(this.fullPath)}?alt=media`
  }

  // set url(url) {
  //   this.#url = url
  // }

  /**
   * 
   * @param {*} sizes 
   * @returns 
   */

  // URL of one resized version (see resize-images' IMAGE_SIZES) - the exact
  // URL <Picture> requests for it, which the offline downloads rely on.
  getThumbnailUrl(dimension, format = THUMBNAIL_FORMATS[0]) {
    const isProd = window.location.hostname !== 'localhost'
    const baseUrl = isProd ? `https://storage.googleapis.com/${storage.app.options.storageBucket}` : `http://localhost:9199/v0/b/${FIREBASE_CONFIG.storageBucket}/o/?alt=media`
    const url = new URL(baseUrl)
    // Copies redone (scripts/fix-photo-orientation.js) carry their revision in
    // their name: a new URL, so no cache keeps serving the old ones.
    // A panorama's small copies can show a view taken in the viewer instead
    // (setViewThumbnail), under their own revision.
    const fromView = this.viewThumbnailRevision > 0 && VIEW_THUMBNAIL_SIZES.includes(dimension)
    const revision = fromView ? `-v${this.viewThumbnailRevision}` : this.thumbnailRevision > 1 ? `-r${this.thumbnailRevision}` : ''
    const thumbnailPath = `caves/${this.caveId}/${THUMBNAIL_FOLDER}/${this.id}_${dimension}${revision}.${format}`

    if (isProd) {
      url.pathname += `/${thumbnailPath}`
    } else {
      url.pathname += encodeURIComponent(thumbnailPath)
    }

    return url.href
  }

  getSources(dimensions, { sizes = false } = {}) {
    if (!Array.isArray(dimensions)) {
      dimensions = [dimensions]
    }

    const sources = []

    for (const format of THUMBNAIL_FORMATS) {
      const srcSet = dimensions.map((dimension, i) => {
        const imageSize = IMAGE_SIZES[dimension]
        return `${this.getThumbnailUrl(dimension, format)}${i === dimensions.length - 1 ? `` : ` ${imageSize.width}w`}`
      }).join(', ')


      const source = {
        srcSet,
        type: `image/${format}`
      }

      if (sizes) {
        source.sizes = `(min-width: ${breakpoints.md}px) calc(100vw - ${PANE_WIDTH}px), 100vw`
      }
      sources.push(source)
    }

    return sources
  }

  async setAsCoverImage() {
    const q = query(COLL, where('caveId', '==', this.caveId), where('type', '==', 'image'), where('isCover', '==', true))
    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) {
      for (const doc of querySnapshot.docs) {
        await updateDoc(doc.ref, {
          isCover: false
        })
      }
    }

    const docRef = doc(db, CAVES_ASSETS_COLL_NAME, this.id)

    await updateDoc(docRef, {
      isCover: true
    })
  }

  // A panorama's small copies (cover, lists) made from a view taken in the
  // viewer: { image (base64), view } (capturePanoramaView).
  async setViewThumbnail({ image, view }) {
    assertOnline()
    await httpsCallable(functions, 'setViewThumbnail')({ assetId: this.id, image, view })
  }

  async upload(file, callback) {
    // Uploading needs the connection: offline, a clear error now (code
    // 'offline') rather than a request hanging until it times out.
    assertOnline()
    const self = this
    return new Promise(async (resolve, reject) => {
      self.originalName = file.name
      self.fullPath = `caves/${self.caveId}/${self.type}s/${self.id}`
      self.mediaType = file.type

      // caveId/type/id are re-derived server-side from the storage path, which
      // can't be spoofed independently of where the object actually lands.
      // Only userId needs a Storage rule check, so keep the metadata flat and minimal.
      const customMetadata = {
        originalName: self.originalName,
      }

      if (self.userId) {
        customMetadata.userId = self.userId
      }

      const fileRef = ref(storage, self.fullPath)
      const uploadTask = uploadBytesResumable(fileRef, file, { customMetadata })
      uploadTask.on(
        'state_changed',
        snap => {
          // track the upload progress
          // console.log('[uploadTask] task snapshoot: %o', snap)
          callback(snap.bytesTransferred)
        },

        //
        // Error handler
        //
        error => {
          console.error('[uploadTask] Error: %o', error)
          reject(error)
        },

        //
        // Success handler
        //
        async () => {
          resolve(this)
        }
      )
    })
  }
}

export function useCaveAssetsList(caveId) {
  const q = useMemo(
    () => query(COLL, where('caveId', '==', caveId), where('type', '==', 'image')).withConverter(converter),
    [caveId],
  )

  const [snapshot, loading, error] = useCollection(q, {
    snapshotListenOptions: { includeMetadataChanges: true }
  })
  // Without the photos in the trash (same shape: docs, empty, size), the
  // cover first.
  const visible = useMemo(() => coverFirst(withoutTrashed(snapshot)), [snapshot])

  return [visible, loading, error]
}

export function useCoverImage(caveId) {
  const q = query(COLL, where('caveId', '==', caveId), where('type', '==', 'image'), where('isCover', '==', true)).withConverter(converter)
  const [snapshot, loading, error] = useCollection(q)
  // Read from the snapshot, not copied to state by an effect: that took one
  // more render, in which the cave seemed to have no cover. A cover in the
  // trash isn't one.
  const coverImage = snapshot?.docs.find((d) => !isTrashed(d))

  return [coverImage, loading, error]
}

export function getImageAssetUrl(source, resize = {}, quality = 80) {

  const url = `https://${FIREBASE_CONFIG.location}-${FIREBASE_CONFIG.projectId}.cloudfunctions.net/ext-image-processing-api-handler/process?operations=`

  const options = builder()
    .input({
      type: 'gcs',
      source,
    })
    .resize(resize)
    .output({ webp: { reductionEffort: 3, quality } })
    .toEncodedString()

  return `${url}${options}`
}

const converter = {
  toFirestore: (caveAsset) => {
    return caveAsset.toObject()
  },
  fromFirestore: (snapshot, options) => {
    const data = snapshot.data(options)
    const caveAsset = new CaveAsset(data)
    const props = ['id', '_created', '_updated', 'date', 'width', 'height', 'orientation', 'isCover', 'position', 'usePanoramaViewer', 'projectionType', 'poseHeadingDegrees', 'mediaType', 'type', 'fullPath', 'thumbnailRevision', 'viewThumbnailRevision', 'thumbnailView', 'deletedAt', 'deletedBy']
    props.forEach(prop => {
      if (Reflect.has(data, prop)) {
        caveAsset[prop] = data[prop]
      }
    })
    // Assets are stored under their own id, so the doc id is the fallback
    // when the data lacks an `id` field - otherwise the constructor's fresh
    // random id would point every thumbnail URL at a file that doesn't exist.
    if (!Reflect.has(data, 'id')) {
      caveAsset.id = snapshot.id
    }
    return caveAsset
  }
}

export const getById = CaveAsset.getById
export const deleteById = CaveAsset.deleteById
export const restoreById = CaveAsset.restoreById
export const getCoverImage = CaveAsset.getCoverImage
export const getAssetList = CaveAsset.getAssetList