import { forwardRef } from 'react'
import Scrollbars2 from 'react-custom-scrollbars-2'
import { useTheme } from '@mui/material'
import { scrollbarTrackHeight } from '@/config/app'
import './Scrollbars.scss'

const DefaultTrackHorizontal = forwardRef(function DefaultTrackHorizontal({ style, trackHorizontalProps = {}, ...otherProps }, ref) {
  const { style: trackHorizontalStyle, trackHorizontalOtherProps } = trackHorizontalProps

  return (
    <div
      ref={ref}
      {...trackHorizontalOtherProps}
      className='oc-scrollbar--track oc-scrollbar--track-horizontal'
      style={{
        ...style,
        height: scrollbarTrackHeight,
        right: 8,
        bottom: 2,
        left: 8,
        borderRadius: scrollbarTrackHeight / 2,
        ...trackHorizontalStyle
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
      className='oc-scrollbar--track oc-scrollbar--track-vertical'
      style={{
        ...style,
        width: scrollbarTrackHeight,
        right: 2,
        bottom: 8,
        top: 8,
        borderRadius: scrollbarTrackHeight / 2,
        ...trackVerticalStyle
      }}
      {...otherProps}
    />
  )
})

const Scrollbars = forwardRef(function Scrollbars({ children, autoHide = true, trackHorizontalProps = {}, trackVerticalProps = {}, ...props }, ref) {
  const renderTrackHorizontal = props.renderTrackHorizontal || (({ style, ...props }) => (
    <DefaultTrackHorizontal
      style={style}
      trackHorizontalProps={trackHorizontalProps}
      {...props}
    />
  ))

  const TrackVertical = forwardRef(function TrackVertical(props, ref) {
    return (
      <DefaultTrackVertical ref={ref} {...props} />
    )
  })

  const renderTrackVertical = props.renderTrackVertical || TrackVertical.render

  return (
    <Scrollbars2
      ref={ref}
      {...props}
      className={`oc-scrollbar${autoHide ? ' oc-scrollbar--autohide' : ''}`}
      autoHide={false}
      renderTrackHorizontal={renderTrackHorizontal}
      renderTrackVertical={renderTrackVertical}
    >
      {children}
    </Scrollbars2 >
  )
})

export default Scrollbars