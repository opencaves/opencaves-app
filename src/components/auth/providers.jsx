import { FacebookAuthProvider, GoogleAuthProvider, OAuthProvider } from 'firebase/auth'

// Microsoft accounts (Outlook, Hotmail, Live, work and school), an OAuth
// provider in Firebase. A class, like GoogleAuthProvider, for the sign-in
// components' `new Provider()`; it always offers the account picker.
export class MicrosoftAuthProvider extends OAuthProvider {
  static PROVIDER_ID = 'microsoft.com'

  constructor() {
    super(MicrosoftAuthProvider.PROVIDER_ID)
    this.setCustomParameters({ prompt: 'select_account' })
  }
}

export const googleProvider = new GoogleAuthProvider()

// Facebook, its email asked for so an existing account can be recognized. A
// class, like MicrosoftAuthProvider, for the sign-in components.
export class FacebookEmailAuthProvider extends FacebookAuthProvider {
  constructor() {
    super()
    this.addScope('email')
  }
}

export const facebookProvider = new FacebookEmailAuthProvider()

export const microsoftProvider = new MicrosoftAuthProvider()

export function getProviderForProviderId(providerId) {
  switch (providerId) {
    case 'google.com': return googleProvider
    case 'microsoft.com': return microsoftProvider
    case 'facebook.com': return facebookProvider
    default: return null
  }
}