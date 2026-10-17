import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Box, Tab, Tabs } from '@mui/material'
import { useTitle } from '@/hooks/useTitle.jsx'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import ChangesTab from './ChangesTab.jsx'
import TrashTab from './TrashTab.jsx'
import { useAccounts } from './useAccounts.js'

const TABS = ['changes', 'trash']

/**
 * /audits (admins): who changed what in the data, to look at and undo
 * (Changes), and the photos and maps deleted to the trash, to restore or
 * delete for good (Trash, ?tab=trash).
 */
export default function Audits() {
  const { t } = useTranslation(['audits', 'dashboard'])
  const { setTitle } = useTitle()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'changes'
  const { accountLabel, accountList, failed: accountsFailed } = useAccounts()

  useEffect(() => {
    setTitle(t('title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  function changeTab(_, next) {
    setSearchParams(next === 'changes' ? {} : { tab: next }, { replace: true })
  }

  return (
    <Box className="oc-audits" sx={{ minHeight: '100%', minWidth: 0 }}>
      <IndexPageHeader title={t('title')} backTo="/dashboard" />

      <Tabs className="oc-audits--tabs" value={tab} onChange={changeTab} aria-label={t('title')} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tab value="changes" label={t('tabs.changes')} id="oc-audits-tab-changes" aria-controls="oc-audits-panel-changes" />
        <Tab value="trash" label={t('tabs.trash')} id="oc-audits-tab-trash" aria-controls="oc-audits-panel-trash" />
      </Tabs>

      {accountsFailed && (
        <Alert className="oc-audits--accounts-error" severity="warning" sx={{ mb: 2 }}>
          {t('accountsError')}
        </Alert>
      )}

      <Box role="tabpanel" id={`oc-audits-panel-${tab}`} aria-labelledby={`oc-audits-tab-${tab}`}>
        {tab === 'changes' ? <ChangesTab accountLabel={accountLabel} accountList={accountList} /> : <TrashTab accountLabel={accountLabel} />}
      </Box>
    </Box>
  )
}
