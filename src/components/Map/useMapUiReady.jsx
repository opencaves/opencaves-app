import { useEffect, useState } from 'react'
import { useMatches } from 'react-router-dom'
import waitForDom from '@/utils/wait-for-dom.jsx'

export function useMapUiReady(mapLoaded, currentMarkerElem) {
  const hasMarker = arguments.length === 2
  const [uiReady, setUiReady] = useState(false)
  const [resultPaneLoaded, setResultPaneLoaded] = useState(false)
  const [currentMarkerLoaded, setCurrentMarkerLoaded] = useState(hasMarker ? false : true)
  const matches = useMatches()

  // Wait for current marker ready if needed
  useEffect(() => {
    if (currentMarkerElem) {
      setCurrentMarkerLoaded(true)
    }
  }, [currentMarkerElem])

  // Wait for result pane if needed
  useEffect(() => {

    async function waitForResultPaneUiReady() {
      await waitForDom('#result-pane')
      setResultPaneLoaded(true)
    }

    if (!matches.some(match => match.id === 'result-pane')) {
      // No result pane will be displayed, so skip waiting
      setResultPaneLoaded(true)
      return
    }

    waitForResultPaneUiReady()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Wait for result pane if needed
  useEffect(() => {

    async function waitForActiveMarkerUiReady() {
      await waitForDom('#active-marker')
      setResultPaneLoaded(true)
    }

    if (!matches.some(match => match.id === 'result-pane')) {
      // No result pane will be displayed, so skip waiting
      setCurrentMarkerLoaded(true)
      return
    }

    waitForActiveMarkerUiReady()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])



  useEffect(() => {
    if (mapLoaded && resultPaneLoaded && currentMarkerLoaded) {
      setUiReady(true)
    }
  }, [mapLoaded, resultPaneLoaded, currentMarkerLoaded])

  return uiReady
}