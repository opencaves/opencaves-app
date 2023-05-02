import Tooltip from "@mui/material/Tooltip"
import { styled } from "@mui/material/styles"
import { forwardRef, useRef } from 'react'

const OCTooltip = styled(forwardRef(({ className, ...props }) => {
  const ref = useRef()

  return (
    <Tooltip {...props} ref={ref} componentsProps={{ tooltip: { className: className } }} />
  )
}))(`
    background-color: #000;
    color: #fff;
    padding-start: 8px;
    padding-end: 8px;
    padding-top: 2px;
    padding-bottom: 2px;
    margin: 4px!important;

    border-radius: 6px;
    line-height: 1.25rem;
    font-weight: 400;
    letter-spacing: 0.01428571em;
    font-size: 0.875rem;
`)

export default OCTooltip

/*
.MuiTooltip-popper[data-popper-placement*="bottom"] .css-2riifr-MuiTooltip-tooltip {
    transform-origin: center top;
    margin-top: 14px;
}
*/