import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * The breadcrumbs above a page reached from the dashboard (its admin and
 * editing pages): Home, then Dashboard - the page's own name ends them
 * (IndexPageHeader's `trail`, then its `current`).
 *
 * @returns {{ label: string, to: string }[]}
 */
export function useDashboardTrail() {
  const { t } = useTranslation('app')
  return useMemo(
    () => [
      { label: t('menu.home'), to: '/' },
      { label: t('menu.admin'), to: '/dashboard' },
    ],
    [t],
  )
}
