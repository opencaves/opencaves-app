import { UNSAFE_ErrorResponseImpl as ErrorResponse } from 'react-router-dom'

// For an index page whose address names nothing (an unknown area or
// system): thrown during render, it shows the app's "not found" page (the
// root route's errorElement, NoMatch, which also marks it noindex).
export function throwNotFound() {
  throw new ErrorResponse(404, 'Not Found', null)
}
