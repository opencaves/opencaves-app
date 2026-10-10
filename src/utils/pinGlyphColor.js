import { getLuminance } from '@mui/material/styles'

export const PIN_GLYPH_LIGHT = '#fff'
export const PIN_GLYPH_DARK = '#000'

// Relative luminance above which a pin's white glyph washes out. Deliberately
// higher than the ~0.18 point where black strictly out-contrasts white, so
// only genuinely light colors (white, lime, pastels, light orange) switch and
// mid-tone reds/greens/blues keep the usual white glyph.
const LIGHT_PIN_LUMINANCE = 0.4

/**
 * Glyph color for a pin filled with `pinColor` (its sistema's color).
 *
 * @param {string} pinColor
 * @returns {string}
 */
export function getPinGlyphColor(pinColor) {
  try {
    return getLuminance(pinColor) > LIGHT_PIN_LUMINANCE ? PIN_GLYPH_DARK : PIN_GLYPH_LIGHT
  } catch {
    // Unparseable color string: keep the pin's original white glyph.
    return PIN_GLYPH_LIGHT
  }
}
