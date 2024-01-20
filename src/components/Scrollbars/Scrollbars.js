import { forwardRef } from 'react'
import Scrollbars2 from 'react-custom-scrollbars-2'
import { scrollbarTrackHeight } from '@/config/app'
import './Scrollbars.scss'
import { useTheme } from '@mui/material'

const DefaultThumb = forwardRef(function DefaultThumb(props, ref) {

  return (
    <div
      ref={ref}
      {...props}
    />
  )
})

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
  const { palette } = useTheme()

  function renderThumb({ style, ...props }) {

    return (
      <DefaultThumb
        style={{
          ...style,
          backgroundColor: palette.Scrollbar.bg,
          borderRadius: 'inherit',
          cursor: 'pointer'
        }}
        {...props}
      />
    )
  }

  const renderTrackHorizontal = props.renderTrackHorizontal || (({ style, ...props }) => {

    return (
      <DefaultTrackHorizontal
        style={style}
        trackHorizontalProps={trackHorizontalProps}
        {...props}
      />
    )
  })

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
      renderThumbVertical={renderThumb}
    >
      {children}
    </Scrollbars2 >
  )
})

export default Scrollbars