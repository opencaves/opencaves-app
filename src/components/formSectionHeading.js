// Props for an edit form's section heading (a Typography, or a field's
// labelProps): a semantic h2 with the accented left bar. Shared by the
// sistema and cave edit forms so their sections look the same.
export function formSectionHeadingProps(className) {
  return {
    component: 'h2',
    variant: 'h6',
    className,
    sx: { mt: 1, mb: 3, pl: 1, borderLeft: '3px solid', borderColor: 'secondary.main', fontWeight: 600 },
  }
}
