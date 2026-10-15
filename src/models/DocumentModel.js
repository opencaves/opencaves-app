import { createCollectionModel } from './firestoreCollectionModel.js'
import { DOCUMENTS_COLLECTION } from '@/config/collections.js'

// Further reading (utils/documents.js): deleting one moves it to the trash
// (Audits > Trash), and the reads skip it.
export default createCollectionModel(DOCUMENTS_COLLECTION, { trash: true })
