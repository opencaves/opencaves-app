import { useSelector } from 'react-redux'

/**
 * Whether the signed-in user has every one of these roles (custom claims):
 * those ManageAuth read from the account's token, in the store - false while
 * no one is signed in (or Firebase hasn't reported the session yet).
 *
 * @param {string|string[]} roles
 * @returns {boolean}
 */
export default function useRoles(roles) {
  const userRoles = useSelector((/** @type {RootState} */ state) => state.session.roles)
  const isLoggedIn = useSelector((/** @type {RootState} */ state) => state.session.isLoggedIn)
  const roleList = Array.isArray(roles) ? roles : [roles]
  return isLoggedIn && roleList.every((role) => userRoles.includes(role))
}
