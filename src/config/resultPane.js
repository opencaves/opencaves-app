export const COVER_IMAGE_HEIGHT_RATIO = .5625
export const ASSETS_LIST_CONFIG = {
  height: 300,
  widthRatio: .8,
  maxLength: 18,
  spacing: 8
}
// The 3D strips of a cave's and a system's pages (photos, survey maps): one
// item a column, 4:3, this far apart (px). At most 380 x 285, and never more
// than 56% of the strip's width (cqi: its container's; about 70% once the
// cylinder's front zooms it), so the item in front always has its neighbours
// on the sides, on a phone too.
export const PAGE_STRIP = { height: 285, gap: 8, itemWidth: 'min(380px, 56cqi)', itemHeight: 'calc(min(380px, 56cqi) * 3 / 4)' }
// Keep in sync with .oc-result-pane--head's height in ResultPaneSm.scss.
export const RESULT_PANE_SM_HEAD_HEIGHT = 49
// Keep in sync with --oc-result-pane-sm-upper-height in ResultPaneSm.scss.
export const RESULT_PANE_SM_UPPER_HEIGHT = 48