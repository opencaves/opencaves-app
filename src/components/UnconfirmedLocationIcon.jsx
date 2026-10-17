import { SvgIcon } from '@mui/material'

/**
 * A point whose coordinates aren't confirmed: Material's crosshair with a
 * question mark in place of its centre dot (MyLocation's), as the map's pin
 * for such a cave (pin-location-unknown.svg) has one.
 *
 * @param {import('@mui/material/SvgIcon').SvgIconProps} props
 */
export default function UnconfirmedLocationIcon(props) {
  return (
    <SvgIcon className="oc-unconfirmed-location-icon" {...props}>
      {/* LocationSearchingRounded: the crosshair's ring and ticks. */}
      <path d="M20.94 11c-.46-4.17-3.77-7.48-7.94-7.94V2c0-.55-.45-1-1-1s-1 .45-1 1v1.06C6.83 3.52 3.52 6.83 3.06 11H2c-.55 0-1 .45-1 1s.45 1 1 1h1.06c.46 4.17 3.77 7.48 7.94 7.94V22c0 .55.45 1 1 1s1-.45 1-1v-1.06c4.17-.46 7.48-3.77 7.94-7.94H22c.55 0 1-.45 1-1s-.45-1-1-1zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7" />
      {/* QuestionMarkRounded, shrunk into the ring. */}
      <path transform="translate(7.2 7) scale(.4)" d="M7.92 7.54c-.8-.34-1.14-1.33-.66-2.05C8.23 4.05 9.85 3 11.99 3c2.35 0 3.96 1.070 4.78 2.41.7 1.15 1.11 3.3.03 4.9-1.2 1.77-2.35 2.31-2.97 3.45-.15.27-.24.49-.3.94-.09.73-.69 1.3-1.430 1.3-.87 0-1.58-.75-1.48-1.62.06-.51.18-1.04.46-1.54.77-1.39 2.25-2.21 3.11-3.44.91-1.29.4-3.7-2.18-3.7-1.17 0-1.93.61-2.4 1.34-.35.57-1.08.75-1.69.5M14 20c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2" />
    </SvgIcon>
  )
}
