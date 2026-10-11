// The pages' cards - the dashboard's lists, tables and forms, the index
// pages' lists, a cave's or a system's sections: paper (white, M3's lowest
// container; a step lighter than the page in dark mode) with rounded
// corners, standing out on their page (M3's surface).
export const DASHBOARD_SURFACE_SX = {
  bgcolor: 'background.paper',
  borderRadius: 2,
}

// A list or table: its rows clipped to the rounded corners.
export const DASHBOARD_LIST_SX = { ...DASHBOARD_SURFACE_SX, overflow: 'hidden' }
