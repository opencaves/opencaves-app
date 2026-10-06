// The dashboard pages' lists, tables and form cards: an opaque surface with
// rounded corners, standing out on their translucent page.
export const DASHBOARD_SURFACE_SX = {
  bgcolor: 'var(--oc-page-surface)',
  borderRadius: 2,
}

// A list or table: its rows clipped to the rounded corners.
export const DASHBOARD_LIST_SX = { ...DASHBOARD_SURFACE_SX, overflow: 'hidden' }
