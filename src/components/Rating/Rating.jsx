import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Rating, Typography } from '@mui/material'
import StarBorderRounded from '@mui/icons-material/StarBorderRounded'
import { setUserRating, useCaveRatings } from '@/models/Rating.js'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import './Rating.scss'

/**
 * A cave's star rating: the average of everyone's ratings, live. Editors and
 * admins can rate (one rating each; the stars then show their own rating,
 * and choosing the same star again clears it); everyone else sees it
 * read-only. Empty stars are outlines in the theme's outline colour: filled
 * in one fixed light grey, an unrated cave looked rated 5/5 in dark mode.
 */
export default function OCRating({ caveId, sx }) {
  const { t, i18n } = useTranslation('resultPane', { keyPrefix: 'rating' })
  const [openSnackbar] = useSnackbar()
  const uid = useSelector((state) => state.session.user?.uid)
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  const roles = useSelector((state) => state.session.roles)
  const canRate = !!uid && isLoggedIn && (roles.includes('editor') || roles.includes('admin'))
  const { average, count, own } = useCaveRatings(caveId, canRate ? uid : undefined)

  const formatAverage = (value) => new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 }).format(value)

  function onChange(_, value) {
    setUserRating(caveId, uid, value).catch((error) => {
      console.error(error)
      openSnackbar(t('saveError'))
    })
  }

  return (
    <Box className="oc-rating rating" sx={[(theme) => ({ display: 'inline-flex', alignItems: 'center', gap: 0.5, '& .MuiRating-iconEmpty': { color: theme.vars.sys.color.outline } }), ...(Array.isArray(sx) ? sx : [sx])]}>
      {canRate ? (
        <Box role="group" aria-label={own ? t('yourRating') : t('rateThisCave')} sx={{ display: 'inline-flex' }}>
          <Rating
            name={`cave-rating-${caveId}`}
            value={own ?? average}
            precision={1}
            size="small"
            emptyIcon={<StarBorderRounded fontSize="inherit" />}
            getLabelText={(value) => t('stars', { count: value })}
            onChange={onChange}
          />
        </Box>
      ) : (
        <Rating
          name={`cave-rating-${caveId}`}
          value={average}
          precision={0.5}
          size="small"
          emptyIcon={<StarBorderRounded fontSize="inherit" />}
          getLabelText={() => (average === null ? t('notRated') : t('average', { value: formatAverage(average) }))}
          readOnly
        />
      )}
      {/* Unrated, for those who can't rate: said, not just shown. */}
      {count === 0 && !canRate && (
        <Typography variant="caption" color="text.secondary">
          {t('notRated')}
        </Typography>
      )}
      {count > 0 && (
        <Typography variant="caption" color="text.secondary" title={t('average', { value: formatAverage(average) })}>
          {t('count', { count })}
        </Typography>
      )}
    </Box>
  )
}
