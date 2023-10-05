import { useEffect, useMemo, useState } from 'react'
import { collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import getId from 'unique-push-id'
import exifr from 'exifr/dist/lite.esm.mjs'
import { builder } from '@invertase/image-processing-api'
import { useCollection } from 'react-firebase-hooks/firestore'
import { db, storage, storageResizeImagesExtensionFixed } from '@/config/firebase'
import { firebaseConfig } from '@/config/firebase.config'
import { acceptedMimeTypes } from '@/config/mediaPane'
import { caveAssetsSizes, imageSizes, paneWidth, thumbnailFolder, thumbnailFormats } from '@/config/app'
import { breakpoints } from '@/theme/Theme.js'

const xmpSupportedMediaTypes = acceptedMimeTypes.filter(media => ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff'].includes(media))

const COLL_NAME = 'cavesAssets'
const COLL = collection(db, COLL_NAME)

export default class CaveAsset {

  #url

  static async getById(assetId) {
    return new Promise(async (resolve, reject) => {
      try {

        const assetRef = doc(db, 'cavesAssets', assetId).withConverter(converter)
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

  static async deleteById(assetId) {
    return new Promise(async (resolve, reject) => {
      try {

        const docRef = doc(db, 'cavesAssets', assetId)
        const docSnap = await getDoc(docRef)

        if (!docSnap.exists()) {
          return reject(`Can't delete asset ${assetId}: it doesn't exist.`)
        }

        const { caveId, fullPath } = docSnap.data()
        const assetRef = ref(storage, fullPath)
        await deleteObject(assetRef)
        await deleteDoc(docRef)

        if (storageResizeImagesExtensionFixed) {
          for (const thumbSize of Object.values(caveAssetsSizes)) {
            for (const format of thumbnailFormats) {
              const thumbFullPath = `caves/${caveId}/images/${thumbnailFolder}/${assetId}_${thumbSize}.${format}`
              await deleteObject(ref(storage, thumbFullPath))
            }
          }
        }

        resolve()

      } catch (error) {
        reject(error)
      }
    })
  }

  static async countAssets(caveId) {
    const q = query(COLL, where('caveId', '==', caveId), where('type', '==', 'image'))
    const snapshot = await getCountFromServer(q)
    console.log('snapshot: %o', snapshot)
    return snapshot.data().count
  }

  static async getAssetList(caveId, useSnapshot = true) {
    const q = query(COLL, where('caveId', '==', caveId), where('type', '==', 'image')).withConverter(converter)

    const assetList = { docs: [], empty: true, size: 0 }

    if (useSnapshot) {
      const unsubscribe = onSnapshot(q, ({ docs, empty, size }) => {
        assetList.docs = docs
        assetList.empty = empty
        assetList.size = size
      })
    } else {
      const { docs, empty, size } = await getDocs(q)
      assetList.docs = docs
      assetList.empty = empty
      assetList.size = size
    }

    return assetList
  }

  static async getCoverImage(caveId, useSnapshot = true) {
    return new Promise(async (resolve, reject) => {
      try {
        const q = query(COLL, where('caveId', '==', caveId), where('type', '==', 'image'), where('isCover', '==', true)).withConverter(converter)

        if (useSnapshot) {
          const result = { data: null }
          const unsubscribe = onSnapshot(q, querySnapshot => {
            if (querySnapshot.empty) {
              result.data = null
              return
            }

            result.data = querySnapshot.docs[0].data()

          })

          return resolve(result)
        }

        const querySnapshot = await getDocs(q)

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
    this.created = serverTimestamp()
    this.updated = serverTimestamp()
  }

  toObject() {
    return {
      ...this
    }
  }

  get url() {
    if (window.location.hostname === 'localhost') {
      return `http://localhost:9199/v0/b/${firebaseConfig.storageBucket}/o/${encodeURIComponent(this.fullPath)}?alt=media`
    }
    return `https://storage.googleapis.com/${storage.app.options.storageBucket}${this.fullPath}`
  }

  // set url(url) {
  //   this.#url = url
  // }

  /**
   * 
   * @param {*} sizes 
   * @returns 
   */

  getSources(dimensions, { sizes = false } = {}) {
    if (!Array.isArray(dimensions)) {
      dimensions = [dimensions]
    }

    const sources = []
    const isProd = window.location.hostname !== 'localhost'
    const baseUrl = isProd ? `https://storage.googleapis.com/${storage.app.options.storageBucket}` : `http://localhost:9199/v0/b/${firebaseConfig.storageBucket}/o/?alt=media`
    const { matches: isSmall } = window.matchMedia(`(max-width: ${breakpoints.sm})`)

    for (const format of thumbnailFormats) {
      const srcSet = dimensions.map((dimension, i) => {
        const imageSize = imageSizes[dimension]
        const url = new URL(baseUrl)
        const thumbnailPath = `caves/${this.caveId}/${thumbnailFolder}/${this.id}_${dimension}.${format}`

        if (isProd) {
          url.pathname += thumbnailPath
          //
        } else {
          url.pathname += encodeURIComponent(thumbnailPath)
        }

        return `${url.href}${i === dimensions.length - 1 ? `` : ` ${imageSize.width}w`}`
      }).join(', ')


      const source = {
        srcSet,
        type: `image/${format}`
      }

      if (sizes) {
        source.sizes = `(min-width: ${breakpoints.md}px) calc(100vw - ${paneWidth}px), 100vw`
      }
      sources.push(source)
    }
    console.log('sources: %o', sources)
    return sources
  }

  async setAsCoverImage() {
    const q = query(COLL, where('caveId', '==', this.caveId), where('type', '==', 'image'), where('isCover', '==', true))
    const querySnapshot = await getDocs(q)

    for (const doc of querySnapshot.docs) {
      await updateDoc(doc.ref, {
        isCover: false,
        updated: serverTimestamp()
      })
    }

    const docRef = doc(db, COLL, this.id)
    await updateDoc(docRef, {
      isCover: true,
      updated: serverTimestamp()
    })
  }

  async upload(file, callback) {
    const self = this
    return new Promise((resolve, reject) => {
      self.originalName = file.name
      self.fullPath = `caves/${self.caveId}/${self.type}s/${self.id}`
      const fileRef = ref(storage, self.fullPath)
      const uploadTask = uploadBytesResumable(fileRef, file)
      uploadTask.on(
        'state_changed',
        snap => {
          // track the upload progress
          callback(snap.bytesTransferred)
        },

        //
        // Error handler
        //
        error => {
          reject(error)
        },

        //
        // Success handler
        //
        async () => {

          // XMP metadata extraction
          if (xmpSupportedMediaTypes.includes(file.type)) {
            const meta = await exifr.parse(file, { ifd0: true, tiff: false, xmp: true })

            if (meta) {
              const { ProjectionType, ImageHeight, ImageWidth } = meta

              if (ImageHeight) {
                self.width = ImageWidth
                self.height = ImageHeight
              }

              if (ProjectionType) {
                self.isPanorama = true
              }

            }

          }

          const docRef = doc(db, COLL_NAME, self.id).withConverter(converter)
          await setDoc(docRef, self)
          resolve()
        }
      )
    })
  }
}

export function useCaveAssetsList(caveId) {
  const q = query(COLL, where('caveId', '==', caveId), where('type', '==', 'image')).withConverter(converter)
  const collection = useCollection(q, {
    snapshotListenOptions: { includeMetadataChanges: true }
  })

  return collection
}

export function useCoverImage(caveId) {
  const [coverImage, setCoverImage] = useState()
  const q = query(COLL, where('caveId', '==', caveId), where('type', '==', 'image'), where('isCover', '==', true)).withConverter(converter)
  const [snapshot, loading, error] = useCollection(q)

  useEffect(() => {

    if (snapshot && !snapshot.empty) {
      setCoverImage(snapshot.docs[0])
      return
    }
    setCoverImage()
  }, [snapshot])

  return [coverImage, loading, error]
}

export function getImageAssetUrl(source, resize = {}, quality = 80) {

  const URL = `https://northamerica-northeast1-${firebaseConfig.projectId}.cloudfunctions.net/ext-image-processing-api-handler/process?operations=`

  const options = builder()
    .input({
      type: 'gcs',
      source,
    })
    .resize(resize)
    .output({ webp: { reductionEffort: 3, quality } })
    .toEncodedString()

  return `${URL}${options}`
}

const converter = {
  toFirestore: (caveAsset) => {
    return caveAsset.toObject()
  },
  fromFirestore: (snapshot, options) => {
    const data = snapshot.data(options)
    const caveAsset = new CaveAsset(data)
    const props = ['id', 'isCover', 'isPanorama', 'originalName', 'type', 'created', 'updated', 'fullPath', 'width', 'height']
    props.forEach(prop => {
      if (Reflect.has(data, prop)) {
        caveAsset[prop] = data[prop]
      }
    })
    return caveAsset
  }
}

export const getById = CaveAsset.getById
export const deleteById = CaveAsset.deleteById
export const getCoverImage = CaveAsset.getCoverImage
export const getAssetList = CaveAsset.getAssetList
export const countAssets = CaveAsset.countAssets