import { Search } from '@mui/icons-material'
import './SearchBarMockup.scss'

// A still picture of the map page's search bar (SearchBar), for loading
// screens shown before the real one exists - so the bar stays put from
// index.html's shell to the real page instead of blinking out in between.
// Same geometry as SearchBar (and index.html's #oc-shell - keep in sync).
export default function SearchBarMockup() {
  return (
    <div className="oc-search-bar-mockup" aria-hidden="true">
      <Search className="oc-search-bar-mockup--icon" />
    </div>
  )
}
