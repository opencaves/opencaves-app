import { getDocs, query, where } from 'firebase/firestore'
import pushId from 'unique-push-id'
import { createCollectionModel } from './firestoreCollectionModel.js'

const ConnectionModel = createCollectionModel('connections')

// A sistema has at most one outgoing connection (to its parent). Finds it,
// if any, so the sistema edit form can show/change the current parent.
ConnectionModel.getBySistemaId = async function getBySistemaId(sistemaId) {
  const q = query(ConnectionModel.collectionRef, where('sistemaId', '==', sistemaId))
  const snapshot = await getDocs(q)
  return snapshot.empty ? null : snapshot.docs[0].data()
}

// Creates or updates the sistema's outgoing connection to point at
// `parentSistemaId` (or removes it if `parentSistemaId` is falsy), keeping
// one connection doc per child sistema.
ConnectionModel.setParent = async function setParent(sistemaId, parentSistemaId) {
  const existing = await ConnectionModel.getBySistemaId(sistemaId)

  if (!parentSistemaId) {
    if (existing) {
      await ConnectionModel.remove(existing.id)
    }
    return
  }

  const id = existing?.id || pushId()
  await ConnectionModel.save(id, { sistemaId, parentSistemaId })
}

export default ConnectionModel
