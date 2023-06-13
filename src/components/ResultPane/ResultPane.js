import { useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useSelector } from 'react-redux'
import { TransitionGroup } from 'react-transition-group'
import { Collapse } from '@mui/material'
import ResultPaneSm from './ResultPaneSm'
import ResultPaneLg from './ResultPaneLg'
import './ResultPane.scss'
import { CurrentCaveDetailsHeader, CurrentCaveDetailsContent } from './CurrentCaveDetails'

export default function ResultPane({ caveId }) {
  // console.log('[ResultPane] caveId: %o', caveId)

  const currentCave = useSelector(state => state.map.currentCave)
  const theme = useTheme()
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

  // const currentCave = useMemo(() => caveId && data.find(cave => cave.id === caveId), [data, caveId])

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