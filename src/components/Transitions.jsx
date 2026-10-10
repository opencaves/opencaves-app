import { cloneElement, forwardRef, useEffect, useRef, useState } from 'react'
import { CSSTransition } from 'react-transition-group'
import { useTheme } from '@mui/material'

const enterStyles = {
  opacity: 1,
  transform: 'translate3d(0, 0, 0)'
}

const exitStyles = {
  opacity: 0,
  transform: 'translate3d(50px, 0, 0)'
}

const forwardTransitionStyles = {
  entering: enterStyles,
  entered: enterStyles,
  exiting: exitStyles,
  exited: exitStyles,
}

/**
 * A transition: in from 50px to the right as it fades in, out the same way.
 * Its props are a CSSTransition's; its child takes the styles.
 */
export const Forward = forwardRef(function Forward(/** @type {{ children: import('react').ReactElement<any>, in?: boolean } & Record<string, any>} */ props, ref) {
  const nodeRef = useRef(null)
  const { children, in: inProp, ...others } = props
  const theme = useTheme()
  const [duration, setDuration] = useState(/** @type {number} */ (undefined))
  const [easing, setEasing] = useState(/** @type {string} */ (undefined))

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


    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProp])

  return (
    // @ts-expect-error Neither a timeout nor an addEndListener: CSSTransition needs one (Forward is unused).
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