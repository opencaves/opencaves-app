import { useTranslation } from 'react-i18next'
import { Box } from '@mui/material'
import VideoList from '@/components/ResultPane/VideoList.jsx'
import { useRequireLogin } from '@/hooks/useRequireLogin.jsx'
import IndexSection from './IndexSection.jsx'

// A cave's videos on its page: the map pane's VideoList (its player, its
// Add videos - editors add at once, the others are asked to log in - and
// admins' delete), in a card like the photos'. VideoList spaces itself with
// the pane's padding variables, set here for the card; a video is never
// wider than the card (on a phone).
export default function CaveVideosSection({ cave }) {
  const { t } = useTranslation('resultPane')
  const requireLogin = useRequireLogin()
  const count = Array.isArray(cave.videos) ? cave.videos.filter((video) => video?.trim()).length : 0
  return (
    <IndexSection id="videos" title={t('videosHeader')} count={count || undefined} className="oc-cave-page--videos" card>
      <Box sx={{ containerType: 'inline-size', '--oc-pane-padding-inline': '0px', '--oc-pane-padding-block': '16px', '--oc-video-max-width': '100cqi' }}>
        <VideoList caveId={cave.id} videos={cave.videos} showTitle={false} showAdd onAddUnauthorized={requireLogin} sx={{ px: 0, pt: 0 }} />
      </Box>
    </IndexSection>
  )
}
