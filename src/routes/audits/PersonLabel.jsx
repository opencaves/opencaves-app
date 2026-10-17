import { Box, Typography } from '@mui/material'

/**
 * A person on the Audits page: their name (accountLabel: display name, email,
 * "Deleted account"…), and under it their raw account id - small and
 * selectable, to search for it in the Firebase console. No id (a change made
 * by the server itself), or `hideId` (the trash's cards): the name only.
 * `after` goes on the name's line, right after it (a change's time), not
 * after the id - which is wider, and would push it away.
 *
 * @param {object} props
 * @param {string} [props.uid]
 * @param {(uid: string) => string} props.accountLabel - A person's name, from their uid.
 * @param {boolean} [props.hideId=false] - The name alone, without the account id.
 * @param {import('react').ReactNode} [props.after] - On the name's line, after it.
 * @param {string} [props.className]
 * @param {Sx} [props.sx]
 */
export default function PersonLabel({ uid, accountLabel, hideId = false, after, className, sx }) {
  return (
    <Box component="span" className={['oc-audit-person', className].filter(Boolean).join(' ')} sx={[{ display: 'inline-flex', flexDirection: 'column', minWidth: 0, verticalAlign: 'top' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 1 }}>
        <Typography component="span" variant="body2" className="oc-audit-person--name" sx={{ color: 'text.primary', overflowWrap: 'anywhere' }}>
          {accountLabel(uid)}
        </Typography>
        {after}
      </Box>
      {uid && !hideId && (
        <Typography component="span" variant="caption" className="oc-audit-person--id" sx={{ color: 'text.secondary', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: 1.3, userSelect: 'all', overflowWrap: 'anywhere' }}>
          {uid}
        </Typography>
      )}
    </Box>
  )
}

/**
 * An author filter's option: the name, and the email under it when the name
 * isn't the email itself.
 */
export function AccountOption({ account }) {
  return (
    <Box component="span" className="oc-audit-person oc-audit-person--option" sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <span>{account.name}</span>
      {account.email && account.email !== account.name && (
        <Typography component="span" variant="caption" color="text.secondary">
          {account.email}
        </Typography>
      )}
    </Box>
  )
}
