import { forwardRef, useEffect, useRef, useState } from 'react'
import { Box, IconButton, InputAdornment, TextField } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { Visibility, VisibilityOff } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import PasswordStrengthBar from 'react-password-strength-bar'

const PasswordInput = forwardRef(function PasswordInput(props, ref) {

  const { value,
    minLength = 4,
    error = false,
    onValidityChange = () => { },
    onKeyUp = () => { },
    children,
    ...others } = props

  const { t } = useTranslation('passwordInput')

  const [inputValid, setInputValid] = useState(false)
  const [inputState, setInputState] = useState('indeterminate')
  const [inputError, setInputError] = useState(error)
  const [showPassword, setShowPassword] = useState(false)
  const inputRef = useRef(null)
  const nthUpdate = useRef(0)
  const firstUpdate = useRef(process.env.NODE_ENV === 'production' ? 1 : 2)

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
    setShowPassword(show => !show)
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

  useEffect(() => {
    if (nthUpdate.current < firstUpdate.current) {
      firstUpdate.current++
      return
    }

    setInputState('determinate')
    updateValidity()

  }, [onValidityChange])

  return (
    <Box>
      <TextField
        {...others}
        ref={ref}
        inputRef={inputRef}
        variant='outlined'
        type={showPassword ? 'text' : 'password'}
        name='password'
        value={value}
        required
        error={inputError}
        onKeyUp={onInputKeyUp}
        InputProps={{
          endAdornment: (
            <InputAdornment position='end'>
              <IconButton
                aria-label={t('passwordIcon.ariaLabel')}
                onClick={onShowPasswordClick}
                onMouseDown={onShowPasswordMouseDown}
                edge='end'
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          )
        }}
      />

      <Grid
        container
        height={28}
        sx={{
          '& > *': {
            flexGrow: 1
          }
        }}
      >
        {
          value && (
            <PasswordStrengthBar
              password={value}
              minLength={minLength}
              scoreWords={t('scoreWords', { returnObjects: true })}
              shortScoreWord={t('shortScoreWord')}
            />
          )
        }
      </Grid>
    </Box>
  )
})

export default PasswordInput