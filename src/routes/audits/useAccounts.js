import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { callable } from '@/config/firebase.js'
import { EMULATOR_AUTHOR_ID } from '@/config/audits.js'

const listUsersFn = callable('listUsers')

/**
 * The accounts (listUsers, as on the Users page), to show who made a change
 * by name rather than by account id.
 *
 * @returns {{accountLabel: (uid: string) => string, accountList: object[], loading: boolean, failed: boolean}} accountLabel(uid): the account's display
 *   name, else its email; the local emulators' label; "deleted account" for an
 *   id no account has (once the list is in); the id itself while it loads or
 *   when it couldn't be read.
 */
export function useAccounts() {
  const { t } = useTranslation('audits')
  const [accounts, setAccounts] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    listUsersFn()
      .then(({ data }) => {
        if (!cancelled) setAccounts(new Map(data.users.map((user) => [user.uid, { name: user.displayName?.trim() || user.email || user.uid, email: user.email || '' }])))
      })
      .catch((error) => {
        console.error(error)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const accountLabel = useCallback(
    (uid) => {
      if (!uid) return t('author.system')
      if (uid === EMULATOR_AUTHOR_ID) return t('author.emulator')
      if (accounts?.has(uid)) return accounts.get(uid).name
      return accounts ? t('author.deleted') : uid
    },
    [accounts, t],
  )

  // For the author filters: [{ uid, name, email }], by name.
  const accountList = useMemo(() => (accounts ? [...accounts].map(([uid, account]) => ({ uid, ...account })).sort((a, b) => a.name.localeCompare(b.name)) : []), [accounts])

  return { accountLabel, accountList, loading: !accounts && !failed, failed }
}
