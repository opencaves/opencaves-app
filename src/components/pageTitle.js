// A page's h1, the same on every page (the dashboard's look): the h4 at
// every width, medium weight, a 56x4 accent bar under it (drawn after its
// text: no element of its own, the server-rendered pages' markup unchanged);
// the heading's row or box keeps PAGE_HEADER_SX's margin under it (no line).
// The landing page and What can I do? have heroes of their own.
export const PAGE_TITLE_TYPOGRAPHY_SX = { typography: 'h4', fontWeight: 500 }
export const PAGE_TITLE_SX = {
  ...PAGE_TITLE_TYPOGRAPHY_SX,
  '&::after': { content: '""', display: 'block', width: 56, height: 4, mt: 1.5, borderRadius: 2, bgcolor: 'secondary.main' },
}
// A title centred (sign-in pages): its bar too.
export const CENTERED_PAGE_TITLE_SX = { ...PAGE_TITLE_SX, textAlign: 'center', '&::after': { ...PAGE_TITLE_SX['&::after'], mx: 'auto' } }
export const PAGE_HEADER_SX = { mb: 3 }
// A hero's title (What can I do?): 24px on phones, 34px from 600px up.
export const HERO_PAGE_TITLE_SX = { typography: { xs: 'h5', sm: 'h4' } }
