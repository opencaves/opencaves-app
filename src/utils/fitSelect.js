// A select as wide as its widest option (label included), not the whole
// column: steady as the choice changes, and never wider than its container.
// Its menu keeps the options' descriptions readable, wrapping them.
// 1ch is a digit's width, a bit more than an average letter's: room to
// spare; 56px holds the field's padding and arrow.
export function fitSelectSx(texts) {
  const longest = Math.max(...texts.map((text) => String(text || '').length))
  return { width: `calc(${longest}ch + 56px)`, maxWidth: '100%', alignSelf: 'flex-start' }
}

export const FIT_SELECT_MENU_PROPS = {
  slotProps: { paper: { sx: { maxWidth: 'min(440px, calc(100vw - 32px))', '& .MuiMenuItem-root': { whiteSpace: 'normal' } } } },
}
