import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Collapse, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { TransitionGroup } from 'react-transition-group'
import ResultPaneSm from './ResultPaneSm'
import ResultPaneLg from './ResultPaneLg'
import { CurrentCaveDetailsHeader, CurrentCaveDetailsContent } from './CurrentCaveDetails'
import { useTitle } from '../../hooks/useTitle'
import './ResultPane.scss'

export default function ResultPane() {

  const currentCave = useSelector(state => state.map.currentCave)
  const theme = useTheme()
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))
  const { setTitle } = useTitle()

  useEffect(() => {
    setTitle(currentCave?.name.value)
  }, [currentCave, setTitle])

  return currentCave && (isSmall ? (
    <TransitionGroup>
      <Collapse in={!!currentCave}>
        <ResultPaneSm cave={currentCave}>
          <CurrentCaveDetailsHeader cave={currentCave}></CurrentCaveDetailsHeader>
          <CurrentCaveDetailsContent cave={currentCave}></CurrentCaveDetailsContent>
        </ResultPaneSm>
      </Collapse>
    </TransitionGroup>
  ) : (
    <TransitionGroup>
      <Collapse in={!!currentCave}>
        <ResultPaneLg cave={currentCave}>
          <CurrentCaveDetailsHeader cave={currentCave}></CurrentCaveDetailsHeader>
          <CurrentCaveDetailsContent cave={currentCave}></CurrentCaveDetailsContent>
        </ResultPaneLg>
      </Collapse>
    </TransitionGroup>
  )
  )
}