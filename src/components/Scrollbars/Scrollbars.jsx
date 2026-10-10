import { forwardRef } from 'react'
import { Scrollbars as Scrollbars3 } from 'react-custom-scrollbars-3'
import { SCROLLBAR_TRACK_HEIGHT } from '@/config/app.js'
import './Scrollbars.scss'

const DefaultThumb = forwardRef(function DefaultThumb(props, ref) {
  return <div ref={ref} {...props} />
})

const DefaultTrackHorizontal = forwardRef(function DefaultTrackHorizontal({ style, trackHorizontalProps = {}, ...otherProps }, ref) {
  const { style: trackHorizontalStyle, trackHorizontalOtherProps } = trackHorizontalProps

  return (
    <div
      ref={ref}
      {...trackHorizontalOtherProps}
      className="oc-scrollbar--track oc-scrollbar--track-horizontal"
      style={{
        ...style,
        height: SCROLLBAR_TRACK_HEIGHT,
        right: 8,
        bottom: 2,
        left: 8,
        borderRadius: SCROLLBAR_TRACK_HEIGHT / 2,
        ...trackHorizontalStyle,
      }}
      {...otherProps}
    />
  )
})

const DefaultTrackVertical = forwardRef(function DefaultTrackVertical({ style, trackVerticalProps = {}, ...otherProps }, ref) {
  const { style: trackVerticalStyle, trackVerticalOtherProps } = trackVerticalProps

  return (
    <div
      ref={ref}
      {...trackVerticalOtherProps}
      className="oc-scrollbar--track oc-scrollbar--track-vertical"
      style={{
        ...style,
        width: SCROLLBAR_TRACK_HEIGHT,
        right: 2,
        bottom: 8,
        top: 8,
        borderRadius: SCROLLBAR_TRACK_HEIGHT / 2,
        ...trackVerticalStyle,
      }}
      {...otherProps}
    />
  )
})

const Scrollbars = forwardRef(function Scrollbars({ children, autoHide = true, trackHorizontalProps = {}, trackVerticalProps = {}, ...props }, ref) {
  // The app's thumb, both ways: the horizontal one (the galleries') used to be
  // the library's own 20% black, nearly invisible on the dark theme.
  function renderThumb({ style, ...props }) {
    return (
      <DefaultThumb
        className="oc-scrollbar--thumb"
        style={{
          ...style,
          borderRadius: 'inherit',
          cursor: 'pointer',
        }}
        {...props}
      />
    )
  }

  const renderTrackHorizontal =
    props.renderTrackHorizontal ||
    (({ style, ...props }) => {
      return <DefaultTrackHorizontal style={style} trackHorizontalProps={trackHorizontalProps} {...props} />
    })

  const renderTrackVertical =
    props.renderTrackVertical ||
    (({ style, ...props }) => {
      return <DefaultTrackVertical style={style} trackVerticalProps={trackVerticalProps} {...props} />
    })

  return (
    <Scrollbars3 ref={ref} {...props} className={`oc-scrollbar${autoHide ? ' oc-scrollbar--autohide' : ''}`} autoHide={false} renderTrackHorizontal={renderTrackHorizontal} renderTrackVertical={renderTrackVertical} renderThumbVertical={renderThumb} renderThumbHorizontal={props.renderThumbHorizontal || renderThumb}>
      {children}
    </Scrollbars3>
  )
})

export default Scrollbars
