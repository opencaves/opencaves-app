import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, MenuItem, TextField, Typography } from '@mui/material'
import { setUnits } from '@/redux/slices/preferencesSlice.jsx'
import { saveAccountUnits } from '@/services/unitsPreference.js'
import { automaticUnits, UNIT_SYSTEMS } from '@/utils/units.js'

/**
 * The account page's units setting: metric, imperial, or Automatic (by the
 * browser's region). Lengths and depths across the app follow it (useUnits).
 * Kept on this device, and in the signed-in account so it follows the person.
 *
 * @param {object} props
 * @param {boolean} [props.asField=false] - A labelled field inside another section (the account's personal info).
 */
export default function UnitsSection({ headingProps = {}, asField = false }) {
  const { t } = useTranslation('account')
  const dispatch = useDispatch()
  const user = useSelector((/** @type {RootState} */ state) => state.session.user)
  const choice = useSelector((/** @type {RootState} */ state) => state.preferences?.units) || 'auto'

  function handleChange(event) {
    const next = event.target.value
    dispatch(setUnits(next))
    if (user?.uid && !user.isAnonymous) {
      saveAccountUnits(user.uid, next).catch((error) => console.error(error))
    }
  }

  return (
    <Box component={asField ? 'div' : 'section'} className="oc-units-section">
      {/* asField: a labelled field inside another section (the account's personal info). */}
      {!asField && (
        <Typography component="h2" variant="h6" {...headingProps} id="oc-units-section-title">
          {t('units')}
        </Typography>
      )}
      <TextField select size="small" value={choice} onChange={handleChange} helperText={t('unitsHint')} sx={{ width: 340, maxWidth: '100%' }} label={asField ? t('units') : undefined} slotProps={{ select: asField ? {} : { labelId: 'oc-units-section-title' } }}>
        <MenuItem value="auto">{t('unitsAutomatic', { units: t(`units_${automaticUnits()}`) })}</MenuItem>
        {UNIT_SYSTEMS.map((units) => (
          <MenuItem key={units} value={units}>
            {t(`units_${units}`)}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  )
}
