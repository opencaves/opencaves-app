import { createContext } from 'react'

// The phone result pane's sheet state (ResultPaneSm provides it). In its own
// module so components reading it don't statically import ResultPaneSm,
// which is loaded lazily with Ionic (see utils/ionic.js).
export const ResultPaneSmContext = createContext(/** @type {{ modalPosition: number, paneOpenFactor: number, paneMinimizeFactor: number, titleHidden: boolean, setTitleHidden: (hidden: boolean) => void }} */ (undefined))
