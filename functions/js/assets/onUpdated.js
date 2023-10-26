import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { Timestamp } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions/v1'
import { COLL_NAME } from './constants.js'

export const onAssetUpdated = onDocumentUpdated(`${COLL_NAME}/{assetId}`, event => {
  const dataBefore = event.data.before.data()
  const snapshot = event.data.after
  const dataAfter = event.data.after.data()

  // If all properties except 'updated' are the same,
  // then it means it's the 'updated' prop that has been change.
  // In this case, prevent infinite loop

  const props = new Set([...Object.keys(dataBefore), ...Object.keys(dataAfter)])

  const documentChanged = [...props.values()].reduce((updated, prop) => {
    if (updated) {
      // An updated prop has already been detected
      return updated
    }

    if (prop === 'updated') {
      // Ignore the 'updated' prop
      return updated
    }

    if (!Reflect.has(dataBefore, prop)) {
      // A prop has been added
      // logger.log('[updated] prop added: %s: %s', prop, dataAfter[prop])
      return true
    }

    if (!Reflect.has(dataAfter, prop)) {
      // A prop has been deleted
      // logger.log('[updated] prop deleted: %s', prop)
      return true
    }

    if (prop === 'created') {
      // prop `created` was just set. Ignore this
      return updated
    }

    const propModified = dataAfter[prop] !== dataBefore[prop]
    if (propModified) {
      // logger.log('[updated] prop `%s` modified: %s: %s', prop, dataBefore[prop], dataAfter[prop])
    }

    return propModified

  }, false)

  // logger.log('[updated] object props has changed: %s', documentChanged)

  if (documentChanged) {
    snapshot.ref.set({
      updated: Timestamp.now()
    }, {
      merge: true
    })
  }

})