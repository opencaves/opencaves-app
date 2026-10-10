import { forwardRef, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as PasswordStrengthBarModule from 'react-password-strength-bar'
import { Box, IconButton, InputAdornment, TextField } from '@mui/material'
import { Grid } from '@mui/material'
import Visibility from '@mui/icons-material/VisibilityRounded'
import VisibilityOff from '@mui/icons-material/VisibilityOffRounded'

// Vite's CJS interop for this package's default export is inconsistent across environments.
const PasswordStrengthBar = /** @type {any} */ (PasswordStrengthBarModule).default?.default ?? PasswordStrengthBarModule.default ?? PasswordStrengthBarModule

/**
 * A password field with a show/hide button and a strength bar, that reports
 * whether it's valid once the user has typed in it. Its props are a
 * TextField's; `minLength` is the strength bar's.
 */
const PasswordInput = forwardRef(function PasswordInput(/** @type {import('@mui/material/TextField').TextFieldProps & { minLength?: number, onValidityChange?: (valid: boolean) => void }} */ props, /** @type {import('react').Ref<HTMLDivElement>} */ ref) {
  const { value, minLength = 4, error = false, onValidityChange = () => {}, onKeyUp = () => {}, children, ...others } = props

  const { t } = useTranslation('passwordInput')

  const [inputValid, setInputValid] = useState(false)
  const [inputState, setInputState] = useState('indeterminate')
  const [inputError, setInputError] = useState(error)
  const [showPassword, setShowPassword] = useState(false)
  const inputRef = useRef(null)

  function updateValidity() {
    const valid = inputRef?.current.checkValidity()
    setInputValid(valid)
    setInputError(!valid)
  }

  function onInputKeyUp(event) {
    if (inputState === 'indeterminate') {
      setInputState('determinate')
    }

    updateValidity()

    onKeyUp.call(null, event)
  }

  function onShowPasswordClick() {
    setShowPassword((show) => !show)
  }

  function onShowPasswordMouseDown(event) {
    event.preventDefault()
  }

  useEffect(() => {
    if (value && inputState === 'indeterminate') {
      setInputState('determinate')
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    onValidityChange.call(null, inputValid)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValid])

  return (
    <Box className="oc-password-input">
      <TextField
        {...others}
        ref={ref}
        inputRef={inputRef}
        type={showPassword ? 'text' : 'password'}
        name="password"
        value={value}
        required
        error={inputError}
        onKeyUp={onInputKeyUp}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton aria-label={t('passwordIcon.ariaLabel')} onClick={onShowPasswordClick} onMouseDown={onShowPasswordMouseDown} edge="end">
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      <Grid
        container
        sx={{
          height: 28,
          '& > *': {
            flexGrow: 1,
          },
        }}
      >
        {value && <PasswordStrengthBar password={value} minLength={minLength} scoreWords={t('scoreWords', { returnObjects: true })} shortScoreWord={t('shortScoreWord')} />}
      </Grid>
    </Box>
  )
})

export default PasswordInput
