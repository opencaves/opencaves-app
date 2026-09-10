import { FacebookAuthProvider, GoogleAuthProvider } from 'firebase/auth'

export const googleProvider = new GoogleAuthProvider()

export const facebookProvider = new FacebookAuthProvider()

export function getProviderForProviderId(providerId) {
  switch (providerId) {
    case 'google.com': return googleProvider
    default: return null
  }
}