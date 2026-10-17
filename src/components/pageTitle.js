// The two sizes of a page's h1. A page title (the index, cave and system
// pages, the account, legal, sign-in pages...): 24px on phones, 34px from
// 600px up, regular weight. The dashboard and its pages (IndexPageHeader's
// `dashboard`): the h4 at every width, medium weight, with an accent bar
// under it; the landing page's hero is a display title of its own.
export const PAGE_TITLE_SX = { typography: { xs: 'h5', sm: 'h4' } }
export const DASHBOARD_TITLE_SX = { typography: 'h4', fontWeight: 500 }
