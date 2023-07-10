import { ReactComponent as Logo } from '../images/logo.1.svg'
import './LoadingPage.scss'

export default function LoadingPage() {
  return (
    <div>
      <MapLoading />
    </div>
  )
}

function MapLoading() {

  return (
    <div className='oc-map-loading'>
      <div className='oc-map-loading--box'>
        <Logo />
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