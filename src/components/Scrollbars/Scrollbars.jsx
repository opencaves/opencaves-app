import { forwardRef } from 'react'
import { Scrollbars as Scrollbars3 } from 'react-custom-scrollbars-3'
import { SCROLLBAR_TRACK_HEIGHT } from '@/config/app.js'
import './Scrollbars.scss'

/** @typedef {{ style?: import('react').CSSProperties } & Record<string, any>} TrackProps A track's props, from the library or Scrollbars' callers. */

const DefaultThumb = forwardRef(function DefaultThumb(/** @type {import('react').HTMLAttributes<HTMLDivElement>} */ props, /** @type {import('react').Ref<HTMLDivElement>} */ ref) {
  return <div ref={ref} {...props} />
})

const DefaultTrackHorizontal = forwardRef(function DefaultTrackHorizontal(/** @type {TrackProps & { trackHorizontalProps?: TrackProps }} */ { style, trackHorizontalProps = {}, ...otherProps }, /** @type {import('react').Ref<HTMLDivElement>} */ ref) {
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

const DefaultTrackVertical = forwardRef(function DefaultTrackVertical(/** @type {TrackProps & { trackVerticalProps?: TrackProps }} */ { style, trackVerticalProps = {}, ...otherProps }, /** @type {import('react').Ref<HTMLDivElement>} */ ref) {
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

/**
 * react-custom-scrollbars-3's Scrollbars with the app's thumbs and tracks,
 * shown on hover when `autoHide`. Its props are the library's, plus
 * `trackHorizontalProps` and `trackVerticalProps` (each track's `style`).
 */
const Scrollbars = forwardRef(function Scrollbars(/** @type {import('react-custom-scrollbars-3').ScrollbarProps & { trackHorizontalProps?: TrackProps, trackVerticalProps?: TrackProps } & Record<string, any>} */ { children, autoHide = true, trackHorizontalProps = {}, trackVerticalProps = {}, ...props }, /** @type {import('react').Ref<import('react-custom-scrollbars-3').Scrollbars>} */ ref) {
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
