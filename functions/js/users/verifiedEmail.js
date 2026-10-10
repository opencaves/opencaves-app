// Providers that verify the address themselves. Firebase marks Google
// accounts verified, but leaves Microsoft accounts unverified even though
// Microsoft checked the address, so they're trusted by provider.
const TRUSTED_PROVIDERS = ['google.com', 'microsoft.com']

/**
 * Whether an account's email is known to be the person's: verified by
 * Firebase (the app's emailed sign-up link does this), or from a trusted
 * provider. An account made through Firebase's sign-up API with any address
 * isn't, and doesn't get the editor role.
 *
 * @param {import('firebase-admin/auth').UserRecord} userRecord
 * @returns {boolean}
 */
export function hasVerifiedEmail(userRecord) {
  if (!userRecord.email) return false
  if (userRecord.emailVerified) return true
  return (userRecord.providerData || []).some((provider) => TRUSTED_PROVIDERS.includes(provider.providerId))
}
