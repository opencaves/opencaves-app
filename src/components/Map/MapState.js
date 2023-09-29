import { ReactComponent as Logo } from '@/images/logo/logo-white.svg'
import './MapState.scss'

export function MapLoading() {

  return (
    <div className='oc-map-loading'>
      <div className='oc-map-loading--box'>
        <Logo className='oc-map-loading--logo' />
        <h1>OpenCaves</h1>
        <div className='oc-map-loading--spinner'>
          <svg className='oc-map-loading--spinner-dot spinner-dot-1' viewBox="0 0 64 64" style={{ animationDelay: '0', animationDuration: '750ms' }}><circle transform="translate(32,32)" r="10"></circle></svg>
          <svg className='oc-map-loading--spinner-dot spinner-dot-2' viewBox="0 0 64 64" style={{ animationDelay: '-111ms', animationDuration: '750ms' }}><circle transform="translate(32,32)" r="10"></circle></svg>
          <svg className='oc-map-loading--spinner-dot spinner-dot-3' viewBox="0 0 64 64" style={{ animationDelay: '-220ms', animationDuration: '750ms' }}><circle transform="translate(32,32)" r="10"></circle></svg>
        </div>
      </div>
    </div>
  )
}

export function MapError({ error }) {

  return (
    <div className='oc-map-loading'>
      <div className='oc-map-loading--box'>
        <h1>:-(<br />Something went wrong</h1>
        <pre>{error.stack}</pre>
      </div>
    </div>
  )
}