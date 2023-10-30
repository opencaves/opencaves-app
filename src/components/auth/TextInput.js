import { TextField } from '@mui/material'
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'

const TextInput = forwardRef(function TextInput(props, ref) {

  function v(v) {
    const r = { name }
    for (var key in v) {
      r[key] = v[key]
    }
    return r
  }

  const {
    label,
    name,
    value = '',
    type = 'text',
    error = false,
    helperText,
    autoComplete,
    inputMode,
    maxLength,
    minLength,
    pattern,
    customError = false,
    onValidityChange = () => { },
    onKeyUp = () => { },
    onChange,
    ...others
  } = props

  const [inputState, setInputState] = useState('indeterminate')
  const [inputValidity, setInputValidity] = useState({})
  const [inputError, setInputError] = useState(error)

  const inputRef = useRef(null)

  function updateValidity() {
    const isValid = typeof customError === 'string' ? false : inputRef?.current.checkValidity()
    const validity = { ...v(inputRef?.current.validity), customError, valid: isValid }

    setInputValidity(validity)
    setInputError(!isValid)
  }

  function onInputKeyUp(event) {
    if (inputState === 'indeterminate') {
      setInputState('determinate')
    }

    updateValidity()

    onKeyUp.call(null, event)
  }

  useMemo(() => {
    if (inputRef?.current) {
      if (inputRef?.current.validity.valid !== inputValidity && inputState === 'determinate') {
        updateValidity()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputRef?.current?.validity])

  useMemo(() => {
    if (inputRef?.current) {
      updateValidity()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customError])

  useMemo(() => {
    if (error) {
      setInputState('determinate')
      setInputError(error)
    }
  }, [error])

  useMemo(() => {
    if (value && inputState === 'indeterminate') {
      setInputState('determinate')
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {

    if (inputState === 'indeterminate') {
      return
    }

    onValidityChange.call(null, inputValidity)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValidity])

  // Trigger onValidityChange if one of:
  //   . input has an initial non empty value
  //   . input value changes

  useEffect(() => {
    if (value) {
      updateValidity()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useMemo(() => {
    if (value && inputState === 'determinate') {

      updateValidity()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Initialization
  useEffect(() => {
    setInputValidity(inputRef.current.validity)

    // If a default value is provided, set state to 'determinate'
    if (value) {
      setInputState('determinate')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputRef])

  return (
    <TextField
      {...others}
      ref={ref}
      inputRef={inputRef}
      label={label}
      variant='outlined'
      type={type}
      name={name}
      value={value}
      error={inputError}
      helperText={helperText ? inputError ? helperText : ' ' : null}
      onChange={onChange}
      onKeyUp={onInputKeyUp}
      inputProps={{
        autoComplete,
        inputMode,
        maxLength,
        minLength,
        pattern
      }}
    />
  )
})

export default TextInput