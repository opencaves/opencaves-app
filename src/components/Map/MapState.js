import { ReactComponent as OcLogo } from '../../logo.svg'
import { ReactComponent as Spinner } from '../../images/3-dots-scale.svg'
import './MapState.scss'
import { IonSpinner } from '@ionic/react'

export function MapLoading() {

  return (
    <div className='oc-map-loading'>
      <div className='oc-map-loading--box'>
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
        <h1>Something went wrong :-(</h1>
        <pre>{error.stack}</pre>
      </div>
    </div>
  )
}