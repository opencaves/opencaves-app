import { useId } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material'
import DownloadRounded from '@mui/icons-material/DownloadRounded'
import RouteRounded from '@mui/icons-material/RouteRounded'
import SortByAlphaRounded from '@mui/icons-material/SortByAlphaRounded'
import './CaveConfirmTools.scss'

// OpenStreetMap's attribution page (its licence asks for a link to it).
const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright'

// The orders within each area, each with its icon.
const SORTS = [
  { value: 'area', Icon: SortByAlphaRounded },
  { value: 'road', Icon: RouteRounded },
]

/**
 * The caves still to confirm's tools, at the end of the filters' row
 * (/caves?missing=position): Download for GPS (a GPX file of the list shown),
 * a link-style button, then the order within each area - "Sort" and two
 * icon buttons side by side (MD3's segmented button, icons only: A to Z, or
 * easiest to reach first), each named by its tooltip and its label for
 * screen readers, the chosen one filled.
 *
 * @param {object} props
 * @param {string} props.sort - 'area' or 'road' (utils/roadDistance.js' CAVE_SORTS).
 * @param {(sort: string) => void} props.onSort
 * @param {() => void} props.onDownload
 * @param {boolean} [props.disabled=false] - Nothing to download (an empty list).
 */
export default function CaveConfirmTools({ sort, onSort, onDownload, disabled = false }) {
  const { t } = useTranslation('indexPages')
  const labelId = useId()
  const label = (value) => (value === 'road' ? t('caves.toConfirm.sortRoad') : t('caves.toConfirm.sortArea'))
  return (
    <div className="oc-cave-confirm-tools">
      <button type="button" className="oc-cave-confirm-tools--gpx" onClick={onDownload} disabled={disabled}>
        <DownloadRounded className="oc-cave-confirm-tools--gpx-icon" aria-hidden="true" />
        {t('caves.toConfirm.gpx')}
      </button>
      <div className="oc-cave-confirm-tools--sort">
        <span id={labelId} className="oc-cave-confirm-tools--sort-label">{t('caves.toConfirm.sortPrefix')}</span>
        <ToggleButtonGroup
          className="oc-cave-confirm-tools--sort-group"
          exclusive
          value={sort}
          onChange={(event, value) => value && value !== sort && onSort(value)}
          aria-labelledby={labelId}
        >
          {SORTS.map(({ value, Icon }) => (
            <Tooltip key={value} title={label(value)}>
              <ToggleButton value={value} className="oc-cave-confirm-tools--sort-button" aria-label={label(value)}>
                <Icon fontSize="small" />
              </ToggleButton>
            </Tooltip>
          ))}
        </ToggleButtonGroup>
      </div>
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
