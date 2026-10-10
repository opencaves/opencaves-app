import { Box, Typography } from '@mui/material'

/**
 * A person on the Audits page: their name (accountLabel: display name, email,
 * "Deleted account"…), and under it their raw account id - small and
 * selectable, to search for it in the Firebase console. No id (a change made
 * by the server itself): the name only.
 */
export default function PersonLabel({ uid, accountLabel, className, sx }) {
  return (
    <Box component="span" className={['oc-audit-person', className].filter(Boolean).join(' ')} sx={[{ display: 'inline-flex', flexDirection: 'column', minWidth: 0, verticalAlign: 'top' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Typography component="span" variant="body2" className="oc-audit-person--name" sx={{ color: 'text.primary', overflowWrap: 'anywhere' }}>
        {accountLabel(uid)}
      </Typography>
      {uid && (
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
