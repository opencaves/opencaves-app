// The map icon (MapRounded's drawing), and its crossed-out version in the
// style of Material's Rounded "off" icons (LocationOffRounded): a 2px slash
// with round ends, the map cut away for 1.5px along both sides of it.
// Material has no map-off icon. SVG bodies for a 24x24 viewBox.
const MAP = 'm14.65 4.98-5-1.75c-.42-.15-.88-.15-1.3-.01L4.36 4.56C3.55 4.84 3 5.6 3 6.46v11.85c0 1.41 1.41 2.37 2.72 1.86l2.93-1.14c.22-.09.47-.09.69-.01l5 1.75c.42.15.88.15 1.3.01l3.99-1.34c.81-.27 1.36-1.04 1.36-1.9V5.69c0-1.41-1.41-2.37-2.72-1.86l-2.93 1.14c-.22.08-.46.09-.69.01M15 18.89l-6-2.11V5.11l6 2.11z'
const SLASH = 'M3 3.5 20.5 21'
export const MAP_BODY = `<path d='${MAP}'/>`
export const MAP_OFF_BODY = `<mask id='m'><rect width='24' height='24' fill='white'/><path d='${SLASH}' stroke='black' stroke-width='5' stroke-linecap='round'/></mask><path d='${MAP}' mask='url(#m)'/><path d='${SLASH}' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'/>`
