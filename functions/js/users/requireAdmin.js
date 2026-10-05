import { HttpsError } from 'firebase-functions/v2/https'

// A callable's caller must be an admin (the roles claim). Frozen accounts
// have no roles left (setUserFrozen).
export function requireAdmin(request, message = 'Only admins can do this.') {
  const roles = request.auth?.token?.roles
  if (!request.auth || !Array.isArray(roles) || !roles.includes('admin')) {
    throw new HttpsError('permission-denied', message)
  }
}
