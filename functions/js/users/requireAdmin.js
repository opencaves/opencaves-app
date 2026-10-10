import { HttpsError } from 'firebase-functions/v2/https'

/**
 * A callable's caller must be an admin (the roles claim). Frozen accounts
 * have no roles left (setUserFrozen).
 *
 * @param {import('firebase-functions/v2/https').CallableRequest} request
 * @param {string} [message='Only admins can do this.']
 * @throws {HttpsError} permission-denied when the caller isn't an admin.
 */
export function requireAdmin(request, message = 'Only admins can do this.') {
  const roles = request.auth?.token?.roles
  if (!request.auth || !Array.isArray(roles) || !roles.includes('admin')) {
    throw new HttpsError('permission-denied', message)
  }
}
