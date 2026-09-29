// Ionic (~160 KiB) is only used on phones: the map page's IonApp wrapper and
// the result pane's sheet (IonModal). Everything Ionic goes through this
// module, loaded on demand (loadIonic), so desktop never downloads it - and
// setupIonicReact() has run before any Ionic component renders.
import { setupIonicReact } from '@ionic/react'

setupIonicReact({})

export { IonApp, IonModal } from '@ionic/react'
