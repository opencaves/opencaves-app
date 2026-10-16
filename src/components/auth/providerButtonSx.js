// The sign-in buttons, one look for every provider: neutral, in the app's
// light or dark theme (Google's colours, which Microsoft's guidelines accept
// too) - their logos stay full colour in both, as both ask. The app's button
// shape (AuthButton) is kept.
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

// Google, Microsoft: light and dark.
export const PROVIDER_BUTTON_SX = providerSx(
  { bg: '#ffffff', text: '#1f1f1f', border: '#747775', hover: '#f2f2f2' },
  { bg: '#131314', text: '#e3e3e3', border: '#8e918f', hover: '#262729' },
)
