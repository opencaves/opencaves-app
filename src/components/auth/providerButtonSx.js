// The sign-in buttons in their provider's own colours (its sign-in button
// guidelines), in the app's light or dark theme - their logos stay full colour
// in both, as both ask. The app's button shape (AuthButton) is kept.
const providerSx = (light, dark) => (theme) => ({
  '&&': {
    bgcolor: light.bg,
    color: light.text,
    borderColor: light.border,
    '&:hover': { bgcolor: light.hover, borderColor: light.border },
    ...theme.applyStyles('dark', {
      bgcolor: dark.bg,
      color: dark.text,
      borderColor: dark.border,
      '&:hover': { bgcolor: dark.hover, borderColor: dark.border },
    }),
  },
})

// Google: its light and dark themes.
export const GOOGLE_BUTTON_SX = providerSx(
  { bg: '#ffffff', text: '#1f1f1f', border: '#747775', hover: '#f2f2f2' },
  { bg: '#131314', text: '#e3e3e3', border: '#8e918f', hover: '#262729' },
)

// Microsoft: its light and dark themes.
export const MICROSOFT_BUTTON_SX = providerSx(
  { bg: '#ffffff', text: '#5e5e5e', border: '#8c8c8c', hover: '#f3f3f3' },
  { bg: '#2f2f2f', text: '#ffffff', border: '#2f2f2f', hover: '#3b3b3b' },
)
