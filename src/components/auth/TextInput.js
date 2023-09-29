import { TextField } from '@mui/material'
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'

// <EmailInput onValidityChange={validity => setValidity(validity)}></EmailInput>

function v1(v) {
  return v ? 'valid customError tooShort typeMismatch valueMissing'.split(' ').reduce((o, prop) => ({ ...o, [prop]: v[prop] }), {}) : v
}
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
  // const nthUpdate = useRef(0)
  // const firstUpdate = useRef(process.env.NODE_ENV === 'production' ? 1 : 2)

  function updateValidity() {
    const isValid = typeof customError === 'string' ? false : inputRef?.current.checkValidity()
    const validity = { ...v(inputRef?.current.validity), customError, valid: isValid }
    console.log('[%s] (updateValidity) validity: %o', name, validity)
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

  // useMemo(() => {
  //   if (['determinate', 'indeterminate'].includes(state)) {
  //     setInputState(state)
  //   }
  // }, [state])

  useMemo(() => {
    if (inputRef?.current) {
      console.log('[%s] inputRef?.current?.validity.valid: %o', name, inputRef?.current?.validity.valid)
      console.log('[%s] inputState: %s', name, inputState)
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
    // console.log(`[%s] nthUpdate.current (%s) <= firstUpdate.current (%s) || inputState (%s) === 'indeterminate' ? %s`, name, nthUpdate.current, firstUpdate.current, inputState, nthUpdate.current <= firstUpdate.current || inputState === 'indeterminate')

    if (inputState === 'indeterminate') {
      return
    }

    console.log('[%s] --- calling onValidityChange: %o ---', name, inputValidity)
    onValidityChange.call(null, inputValidity)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValidity])

  // useMemo(() => {
  //   console.log('[%s] (onValidityChange)', name)
  //   if (nthUpdate.current <= firstUpdate.current) {
  //     return
  //   }

  //   console.log('[%s] (onValidityChange) YES', name)
  //   setInputState('determinate')
  //   updateValidity()

  // }, [onValidityChange])

  // useEffect(() => {
  //   console.log('[%s] (onRender) nthUpdate: %o, firstUpdate: %o', name, nthUpdate.current, firstUpdate.current)
  //   if (nthUpdate.current <= firstUpdate.current) {
  //     nthUpdate.current++
  //   }
  // })

  // Trigger onValidityChange if one of:
  //   . input has an initial non empty value
  //   . input value changes

  useEffect(() => {
    if (value) {
      updateValidity()
    }
  }, [])

  useMemo(() => {
    if (value && inputState === 'determinate') {
      console.log('updateValidity !')
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
    <>
      {/* <small style={{ overflowWrap: 'anywhere' }}>
        inputValidity: {JSON.stringify(v1(inputValidity))}<br />
        inputState: {inputState}<br />
        inputError: {`${inputError}`}
      </small> */}
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
    </>
  )
})

export default TextInput