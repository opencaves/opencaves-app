import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Box, Button, Chip, IconButton, InputAdornment, ListItemIcon, ListItemText, Menu, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import ArrowDropDownRounded from '@mui/icons-material/ArrowDropDownRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import CheckRounded from '@mui/icons-material/CheckRounded'
import ChatBubbleOutlineRounded from '@mui/icons-material/ChatBubbleOutlineRounded'
import RadioButtonCheckedRounded from '@mui/icons-material/RadioButtonCheckedRounded'
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded'
import { db } from '@/config/firebase.js'
import { FEEDBACK_COLLECTION } from '@/config/collections.js'
import { FEEDBACK_KINDS, OPEN_FEEDBACK_STATUSES } from '@/utils/feedback.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import { useAccounts } from '@/routes/audits/useAccounts.js'
import { DASHBOARD_LIST_SX } from '@/components/dashboardSurface.js'
import { SEARCH_FIELD_SX } from '@/components/searchFieldSx.js'
import { useIndexSearch } from '@/components/IndexPage/IndexSearchField.jsx'
import ListSkeleton from '@/components/Skeletons/ListSkeleton.jsx'
import { CLOSED_FEEDBACK_STATUSES, KINDS, KindChip, RelativeTime, STATUS, StateIcon, activityOf, isOpen, messageCountOf, statusOf, titleOf, toDate } from './feedbackUi.jsx'

const SORTS = ['newest', 'oldest', 'activity']
const SORTERS = {
  newest: (a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0),
  oldest: (a, b) => (toDate(a.createdAt)?.getTime() || 0) - (toDate(b.createdAt)?.getTime() || 0),
  activity: (a, b) => activityOf(b) - activityOf(a),
}

// A toolbar dropdown (GitHub's list filters): a button naming the filter -
// its value when one is picked - opening its choices.
function FilterMenu({ className, label, value, options, onChange, allLabel }) {
  const [anchor, setAnchor] = useState(null)
  const picked = options.find((option) => option.value === value)
  return (
    <>
      <Button className={className} size="small" color="inherit" endIcon={<ArrowDropDownRounded />} onClick={(event) => setAnchor(event.currentTarget)} aria-haspopup="menu" sx={{ fontWeight: picked ? 700 : 500, textTransform: 'none', whiteSpace: 'nowrap' }}>
        {picked && allLabel ? `${label}: ${picked.label}` : label}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {allLabel && (
          <MenuItem
            selected={!picked}
            onClick={() => {
              setAnchor(null)
              onChange(null)
            }}
          >
            <ListItemText primary={allLabel} />
            {!picked && <CheckRounded fontSize="small" sx={{ ml: 2 }} />}
          </MenuItem>
        )}
        {options.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === value}
            onClick={() => {
              setAnchor(null)
              onChange(option.value)
            }}
          >
            {option.icon && <ListItemIcon>{option.icon}</ListItemIcon>}
            <ListItemText primary={option.label} />
            {option.value === value && <CheckRounded fontSize="small" sx={{ ml: 2 }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

// One report of the list (GitHub's issue row): its state, its title (its
// message's first line, linking to its page), its kind and stage, who sent
// it when and from which page, and how many messages its thread has. The
// whole row opens the report - its only action: the title's link stretched
// over it (::after), still the row's one link for keyboards and screen
// readers; the focus ring drawn on the row. Its time and message count stay
// above the link, for their tooltips.
function ReportRow({ report, authorName, search }) {
  const { t } = useTranslation('feedback')
  const count = messageCountOf(report)
  const status = statusOf(report)
  return (
    <Box component="li" className="oc-feedback-list--row" sx={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 2, py: 1.5, borderTop: 1, borderColor: 'divider', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, '&:hover .oc-feedback-list--title': { color: 'primary.main' }, '&:has(.oc-feedback-list--title:focus-visible)': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 }, '& oc-relative-time': { position: 'relative', zIndex: 1 } }}>
      <StateIcon report={report} sx={{ mt: '2px', fontSize: 20 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography
            component={Link}
            to={`/feedback/${report.id}`}
            state={{ from: search }}
            className="oc-feedback-list--title"
            sx={{ fontWeight: 600, color: 'text.primary', textDecoration: 'none', overflowWrap: 'anywhere', outline: 'none', '&::after': { content: '""', position: 'absolute', inset: 0 }, '&:hover, &:focus-visible': { color: 'primary.main', textDecoration: 'underline' } }}
          >
            {titleOf(report) || t('admin.list.untitled')}
          </Typography>
          <KindChip kind={report.kind} />
          <Chip className="oc-feedback-list--stage" size="small" icon={STATUS[status].icon} color={STATUS[status].color} label={t(`admin.status.${status}`)} />
        </Box>
        <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary', overflowWrap: 'anywhere' }}>
          {t('admin.list.opened')} <RelativeTime value={report.createdAt} /> {t('admin.list.by', { name: authorName })}
          {report.page && ` · ${report.page}`}
        </Typography>
      </Box>
      {count > 0 && (
        <Tooltip title={t('admin.list.messages', { count })}>
          <Box className="oc-feedback-list--count" sx={{ position: 'relative', zIndex: 1, cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', flex: 'none', mt: '2px' }} aria-label={t('admin.list.messages', { count })}>
            <ChatBubbleOutlineRounded sx={{ fontSize: 18 }} />
            <Typography variant="body2" component="span">
              {count}
            </Typography>
          </Box>
        </Tooltip>
      )}
    </Box>
  )
}

/**
 * /feedback (admins): the beta testers' reports (the Send feedback form,
 * _feedback), as GitHub lists issues: Open and Closed tabs (open: new,
 * confirmed or in progress; closed: done, rejected or a duplicate), a search
 * (message, author's name or email, page), kind and stage filters and a
 * sort - all in the address (?state, q, kind, stage, sort), so back/forward
 * and shared links keep them. Each report opens its own page
 * (/feedback/:feedbackId, FeedbackReport). The new ones were also emailed to
 * the admins (onFeedbackCreated).
 */
export default function FeedbackList() {
  const { t } = useTranslation('feedback')
  const { setTitle } = useTitle()
  const { accountLabel, accountList } = useAccounts()
  const [params, setParams] = useSearchParams()
  const [reports, setReports] = useState(null)

  // The search (?q=), as the index pages' (accents and case ignored; the
  // address follows the field once typing pauses).
  const { query: q, setQuery, matches } = useIndexSearch()
  const state = params.get('state') === 'closed' ? 'closed' : 'open'
  const kind = FEEDBACK_KINDS.includes(params.get('kind')) ? params.get('kind') : null
  const stages = state === 'open' ? OPEN_FEEDBACK_STATUSES : CLOSED_FEEDBACK_STATUSES
  const stage = stages.includes(params.get('stage')) ? params.get('stage') : null
  const sort = SORTS.includes(params.get('sort')) ? params.get('sort') : 'newest'

  // A change of the address' query (tab, filters, sort): empty values dropped.
  function update(changes, replace = false) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace })
  }

  useEffect(() => {
    setTitle(t('admin.title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, FEEDBACK_COLLECTION), orderBy('createdAt', 'desc')),
        (snapshot) => setReports(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (error) => {
          console.error(error)
          setReports([])
        },
      ),
    [],
  )

  const emails = useMemo(() => new Map(accountList.map((account) => [account.uid, account.email])), [accountList])
  // The search and kind filter first (the tabs count what they leave), then
  // the tab and stage.
  const matching = useMemo(
    () => (reports || []).filter((report) => (!kind || report.kind === kind) && matches([report.message, report.page, accountLabel(report.userId), emails.get(report.userId)].filter(Boolean))),
    [reports, kind, matches, accountLabel, emails],
  )
  const openCount = matching.filter(isOpen).length
  const list = matching.filter((report) => (state === 'open') === isOpen(report) && (!stage || statusOf(report) === stage)).sort(SORTERS[sort])
  const filtered = Boolean(q || kind || stage || sort !== 'newest')
  const search = params.toString() ? `?${params}` : ''

  const tabSx = (selected) => ({ textTransform: 'none', fontWeight: selected ? 700 : 500, color: selected ? 'text.primary' : 'text.secondary', whiteSpace: 'nowrap' })

  return (
    <div className="oc-feedback-list">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Tooltip title={t('admin.back')}>
          <IconButton component={Link} to="/dashboard" aria-label={t('admin.back')} sx={{ ml: { xs: 0, sm: -4 }, mr: -0.5 }}>
            <ArrowBackRounded />
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="h5">
          {t('admin.title')}
        </Typography>
      </Box>

      <TextField
        className="oc-feedback-list--search"
        type="search"
        fullWidth
        variant="outlined"
        value={q}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('admin.list.search')}
        // MD3's search bar, as the other lists' (CaveList, UsersAdmin, IndexSearchField).
        sx={[SEARCH_FIELD_SX, { mb: 2 }]}
        slotProps={{
          htmlInput: { 'aria-label': t('admin.list.searchLabel'), spellCheck: false },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded />
              </InputAdornment>
            ),
            endAdornment: q && (
              <InputAdornment position="end">
                <IconButton onClick={() => setQuery('')} aria-label={t('admin.list.clearSearch')}>
                  <CloseRounded />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      {filtered && (
        <Button
          className="oc-feedback-list--clear"
          size="small"
          startIcon={<CloseRounded />}
          onClick={() => {
            setQuery('')
            setParams(state === 'closed' ? { state } : {})
          }}
          sx={{ textTransform: 'none', mb: 1 }}
        >
          {t('admin.list.clearFilters')}
        </Button>
      )}

      <Box sx={DASHBOARD_LIST_SX}>
        <Box className="oc-feedback-list--toolbar" sx={(theme) => ({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, px: 1, py: 0.75, bgcolor: theme.vars.sys.color.surfaceContainer })}>
          <Box role="tablist" aria-label={t('admin.title')} sx={{ display: 'flex', gap: 0.5 }}>
            <Button role="tab" aria-selected={state === 'open'} size="small" startIcon={<RadioButtonCheckedRounded />} onClick={() => update({ state: null, stage: null })} sx={tabSx(state === 'open')}>
              {t('admin.list.open', { count: openCount })}
            </Button>
            <Button role="tab" aria-selected={state === 'closed'} size="small" startIcon={<CheckCircleOutlineRounded />} onClick={() => update({ state: 'closed', stage: null })} sx={tabSx(state === 'closed')}>
              {t('admin.list.closed', { count: matching.length - openCount })}
            </Button>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
            <FilterMenu className="oc-feedback-list--kind" label={t('admin.list.kind')} allLabel={t('admin.list.allKinds')} value={kind} onChange={(value) => update({ kind: value })} options={FEEDBACK_KINDS.map((value) => ({ value, label: t(`kinds.${value}`), icon: KINDS[value].icon }))} />
            <FilterMenu className="oc-feedback-list--stage-filter" label={t('admin.list.stage')} allLabel={t('admin.list.allStages')} value={stage} onChange={(value) => update({ stage: value })} options={stages.map((value) => ({ value, label: t(`admin.status.${value}`), icon: STATUS[value].icon }))} />
            <FilterMenu className="oc-feedback-list--sort" label={t('admin.list.sort')} value={sort} onChange={(value) => update({ sort: value === 'newest' ? null : value })} options={SORTS.map((value) => ({ value, label: t(`admin.list.sorts.${value}`) }))} />
          </Box>
        </Box>
        {reports === null ? (
          <ListSkeleton rows={4} fill={false} secondary />
        ) : list.length === 0 ? (
          <Typography sx={{ color: 'text.secondary', px: 2, py: 4, textAlign: 'center', borderTop: 1, borderColor: 'divider' }}>{filtered ? t('admin.list.noMatch') : t('admin.none')}</Typography>
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {list.map((report) => (
              <ReportRow key={report.id} report={report} authorName={accountLabel(report.userId)} search={search} />
            ))}
          </Box>
        )}
      </Box>
    </div>
  )
}
