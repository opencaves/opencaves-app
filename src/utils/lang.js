import supportedLangs from '../config/supportedLangs'

export function ISO6391ToISO6392(code) {
  const lang = supportedLangs.find(l => l.ISO6391 === code)
  if (lang) {
    return lang.ISO6392
  }

  return null
}