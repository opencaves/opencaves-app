/**
 * Props for an edit form's section heading (a Typography, or a field's
 * labelProps): a semantic h2 with the accented left bar. Shared by the
 * sistema and cave edit forms so their sections look the same.
 *
 * @param {string} [className]
 * @returns {object}
 */
export function formSectionHeadingProps(className) {
  return {
    component: 'h2',
    variant: 'h6',
    className,
    sx: { mt: 0, mb: 3, pl: 1, borderLeft: '3px solid', borderColor: 'secondary.main', fontWeight: 600 },
  }
}

// A section with an anchor (its English id, as /account#emails): scrolled
// to clear of the 64px app bar, with some room (Layout's hash scroll).
export const sectionAnchorSx = { scrollMarginTop: 'calc(64px + 16px)' }

// For the Divider between two sections: with the forms' own 16dp gap, 32dp
// on each side.
export const formSectionDividerSx = { my: 2 }
