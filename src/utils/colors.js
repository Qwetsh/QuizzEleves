/**
 * Unified color utilities for hex manipulation.
 */

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h;
  return {
    r: parseInt(full.substring(0, 2), 16),
    g: parseInt(full.substring(2, 4), 16),
    b: parseInt(full.substring(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [r, g, b]
      .map(v => clamp(v).toString(16).padStart(2, '0'))
      .join('')
  );
}

export function lighten(hex, amount = 0.2) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({
    r: r + (255 - r) * amount,
    g: g + (255 - g) * amount,
    b: b + (255 - b) * amount,
  });
}

export function darken(hex, amount = 0.2) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({
    r: r * (1 - amount),
    g: g * (1 - amount),
    b: b * (1 - amount),
  });
}
