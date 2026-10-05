import { createCollectionModel } from './firestoreCollectionModel.js'

// Survey maps: deleting one moves it to the trash (Audits > Trash), and the
// reads skip it.
export default createCollectionModel('maps', { trash: true })
