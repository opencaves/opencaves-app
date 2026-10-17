import { Trans, useTranslation } from 'react-i18next'
import { Button, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import DownloadRounded from '@mui/icons-material/DownloadRounded'
import './CaveConfirmTools.scss'

// OpenStreetMap's attribution page (its licence asks for a link to it).
const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright'

/**
 * The caves still to confirm's tools, above their list (/caves?missing=position):
 * its order - by area, or easiest to reach first (by road distance; MD3's
 * segmented button) - and Download for GPS (a GPX file of the list shown).
 *
 * @param {object} props
 * @param {string} props.sort - 'area' or 'road' (utils/roadDistance.js' CAVE_SORTS).
 * @param {(sort: string) => void} props.onSort
 * @param {() => void} props.onDownload
 * @param {boolean} [props.disabled=false] - Nothing to download (an empty list).
 */
export default function CaveConfirmTools({ sort, onSort, onDownload, disabled = false }) {
  const { t } = useTranslation('indexPages')
  return (
    <div className="oc-cave-confirm-tools">
      <ToggleButtonGroup
        className="oc-cave-confirm-tools--sort"
        size="small"
        exclusive
        value={sort}
        onChange={(event, value) => value && onSort(value)}
        aria-label={t('caves.toConfirm.sortLabel')}
      >
        <ToggleButton value="area">{t('caves.toConfirm.sortArea')}</ToggleButton>
        <ToggleButton value="road">{t('caves.toConfirm.sortRoad')}</ToggleButton>
      </ToggleButtonGroup>
      <Button className="oc-cave-confirm-tools--gpx" variant="outlined" startIcon={<DownloadRounded />} onClick={onDownload} disabled={disabled}>
        {t('caves.toConfirm.gpx')}
      </Button>
    </div>
  )
}

/**
 * The road distances' credit line, under the list: OpenStreetMap's
 * contributors (linked to its copyright page, as its licence asks) and the
 * roads' month.
 *
 * @param {object} props
 * @param {string} props.asOf - The roads' month ('YYYY-MM').
 */
export function RoadsCredit({ asOf }) {
  const { t, i18n } = useTranslation('indexPages')
  const date = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${asOf}-01T00:00:00Z`))
  return (
    <Typography className="oc-cave-confirm-tools--credit" variant="body2" color="text.secondary">
      <Trans
        t={t}
        i18nKey="caves.toConfirm.credit"
        values={{ date }}
        components={{ osm: <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener noreferrer" /> }}
      />
    </Typography>
  )
}
