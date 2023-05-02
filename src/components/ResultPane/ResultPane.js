import React, { useMemo, useRef, useState } from 'react'
import { useMediaQuery } from 'react-responsive'
import { useDispatch, useSelector } from 'react-redux'
import ResultPaneSm from './ResultPaneSm'
import ResultPaneLg from './ResultPaneLg'
import './ResultPane.scss'
import { CurrentCaveDetailsHeader, CurrentCaveDetailsContent } from './CurrentCaveDetails'

export default function ResultPane({ caveId }) {
  console.log('[ResultPane] caveId: %o', caveId)

  const data = useSelector(state => state.map.data)
  const isSmall = useMediaQuery({
    query: '(max-width: 767px)'
  })

  const currentCave = useMemo(() => caveId && data.find(cave => cave.id === caveId), [data, caveId])

  return currentCave && (isSmall ? (
    <ResultPaneSm cave={currentCave}>
      <CurrentCaveDetailsHeader cave={currentCave}></CurrentCaveDetailsHeader>
      <CurrentCaveDetailsContent cave={currentCave}></CurrentCaveDetailsContent>
    </ResultPaneSm>
  ) : (
    <ResultPaneLg cave={currentCave}>
      <CurrentCaveDetailsHeader cave={currentCave}></CurrentCaveDetailsHeader>
      <CurrentCaveDetailsContent cave={currentCave}></CurrentCaveDetailsContent>
    </ResultPaneLg>
  ))
}