import { cloneElement, forwardRef, useEffect, useRef, useState } from 'react'
import { CSSTransition } from 'react-transition-group'
import { useTheme, Slide } from '@mui/material'

const enterStyles = {
  opacity: 1,
  transform: 'translate3d(0, 0, 0)'
}

const exitStyles = {
  opacity: 0,
  transform: 'translate3d(50px, 0, 0)'
}

export const forwardTransitionStyles = {
  entering: enterStyles,
  entered: enterStyles,
  exiting: exitStyles,
  exited: exitStyles,
}

export const Forward = forwardRef(function Forward(props, ref) {
  const nodeRef = useRef(null)
  const { children, in: inProp, ...others } = props
  const theme = useTheme()
  const [duration, setDuration] = useState()
  const [easing, setEasing] = useState()

  // const duration = inProp ? theme.oc.sys.duration.emphasizedDecelerate : theme.oc.sys.duration.emphasizedAccelerate
  const defaultStyle = {
    willChange: 'transform, opacity',
    transitionProperty: 'transform, opacity',
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: easing,
    ...enterStyles,
    border: '1px solid red',
    minWidth: '100px',
    minHeight: '100px'
  }

  useEffect(() => {
    const duration = inProp ? theme.oc.sys.motion.duration.emphasizedDecelerate : theme.oc.sys.motion.duration.emphasizedAccelerate
    setDuration(duration)

    const easing = inProp ? theme.sys.motion.easing.emphasizedDecelerate : theme.sys.motion.easing.emphasizedAccelerate
    setEasing(easing)

    console.log('inProp: %o, duration: %o, easing: %o', inProp, duration, easing)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProp])

  return (
    <CSSTransition
      {...others}
      nodeRef={nodeRef}
      in={inProp}
      unmountOnExit={true}
    >
      {
        (state, childProps) => {
          return cloneElement(children, {
            ref: nodeRef,
            style: {
              ...defaultStyle,
              ...forwardTransitionStyles[state],
              ...children.props.style
            },
            ...childProps
          })
        }
        // (
        //   <div ref={nodeRef} style={{
        //     ...defaultStyle,
        //     ...forwardTransitionStyles[state]
        //   }}
        //   >
        //     {children}
        //   </div>
        // )
      }
    </CSSTransition>
  )
})

export const Awef = forwardRef(function Awef(props, ref) {
  return <Slide direction='up' ref={ref} {...props} />
})