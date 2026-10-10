import { createContext } from 'react'

// While the desktop pane closes (its route left), ResultPaneOutlet keeps it
// rendered and provides the callback that unmounts it once it has shrunk;
// null the rest of the time.
export const ResultPaneExitContext = createContext(null)
