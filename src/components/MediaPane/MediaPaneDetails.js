
import { styled } from '@mui/material'
import usePaneWidth from '@/hooks/usePaneWidth'

const Main = styled('main')(
  ({ theme, open }) => {
    const paneWidth = usePaneWidth()
    console.log('paneWidth: %o', paneWidth)

    return ({
      flexGrow: 1,
      padding: theme.spacing(3),
      backgroundColor: '#000',
      position: 'relative',
      zIndex: theme.zIndex.drawer,
      display: 'flex'
    })
  },
)

export default function MediaPaneDetails({ mediaId }) {
  return (
    <Main>
      <div style={{ width: 100, height: 100, backgroundColor: 'red' }}>
        Main!<br />
        {mediaId}
      </div>
    </Main>
  )
}