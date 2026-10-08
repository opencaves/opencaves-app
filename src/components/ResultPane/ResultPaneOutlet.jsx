import { useCallback, useRef, useState } from 'react'
import { useOutlet } from 'react-router-dom'
import { ResultPaneExitContext } from './resultPaneExit.js'

// The map page's outlet (the cave's details pane). With keepOnExit
// (desktop), leaving the cave's route keeps its last element rendered, with
// its own route context (same cave), until the pane has shrunk away
// (ResultPaneLg) - a plain outlet would drop it at once.
export default function ResultPaneOutlet({ keepOnExit }) {
  const outlet = useOutlet()
  const lastOutletRef = useRef(null)
  const [, setExitDone] = useState(0)

  if (outlet) lastOutletRef.current = outlet
  else if (!keepOnExit) lastOutletRef.current = null
  const element = outlet ?? lastOutletRef.current

  const onExited = useCallback(() => {
    lastOutletRef.current = null
    setExitDone(count => count + 1)
  }, [])

  return <ResultPaneExitContext.Provider value={outlet ? null : onExited}>{element}</ResultPaneExitContext.Provider>
}
