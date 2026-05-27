import React from 'react';

/* ── Color utilities ─────────────────────────────────────────────── */

function hexToRgb(hex) {
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

function rgbToHex({ r, g, b }) {
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

/* ── Animal glyphs ───────────────────────────────────────────────── */

const GLYPH_FILL = 'rgba(255,255,255,0.96)';
const GLYPH_STROKE = 'rgba(0,0,0,0.18)';
const GLYPH_SW = 0.6;

function GlyphLion() {
  const fill = GLYPH_FILL;
  const stroke = GLYPH_STROKE;
  const sw = GLYPH_SW;
  return (
    <g fill={fill} stroke={stroke} strokeWidth={sw}>
      <circle cx="0" cy="-10" r="9" />
      <path d="M -8 -14 L -12 -22 L -7 -18 Z M 8 -14 L 12 -22 L 7 -18 Z" />
      <path d="M -3 -8 L -2 -5 L 2 -5 L 3 -8 Z" />
      <circle cx="-3" cy="-11" r="1.2" fill="#1a1a1a" stroke="none" />
      <circle cx="3" cy="-11" r="1.2" fill="#1a1a1a" stroke="none" />
      <path d="M -2 -7 Q 0 -5 2 -7" fill="none" strokeWidth="1.2" />
      <path d="M -12 -10 Q -16 -2 -10 4 Q -14 -2 -12 -10 Z" />
      <path d="M 12 -10 Q 16 -2 10 4 Q 14 -2 12 -10 Z" />
      <path d="M -10 -18 Q -8 -22 -4 -20 M 10 -18 Q 8 -22 4 -20" fill="none" />
    </g>
  );
}

function GlyphEagle() {
  const fill = GLYPH_FILL;
  const stroke = GLYPH_STROKE;
  const sw = GLYPH_SW;
  return (
    <g fill={fill} stroke={stroke} strokeWidth={sw}>
      <path d="M 0 -16 Q -5 -14 -5 -10 L -8 -8 L -5 -6 L 0 -8 Q 5 -6 5 -10 Q 5 -14 0 -16 Z" />
      <circle cx="-2" cy="-11" r="1" fill="#1a1a1a" stroke="none" />
      <path d="M 0 -6 L -6 0 L -4 8 L 4 8 L 6 0 Z" />
      <path d="M -6 -2 Q -18 -8 -16 6 Q -10 0 -6 4 Z" />
      <path d="M 6 -2 Q 18 -8 16 6 Q 10 0 6 4 Z" />
      <path d="M -3 8 L 0 14 L 3 8 Z" />
    </g>
  );
}

function GlyphTiger() {
  const fill = GLYPH_FILL;
  const stroke = GLYPH_STROKE;
  const sw = GLYPH_SW;
  return (
    <g fill={fill} stroke={stroke} strokeWidth={sw}>
      <circle cx="0" cy="-8" r="10" />
      <path d="M -9 -16 L -6 -12 L -10 -10 Z M 9 -16 L 6 -12 L 10 -10 Z" />
      <path d="M -7 -12 L -5 -14 M 7 -12 L 5 -14 M -7 -4 L -5 -6 M 7 -4 L 5 -6" stroke="#1a1a1a" strokeWidth="1" fill="none" />
      <circle cx="-3" cy="-9" r="1.2" fill="#1a1a1a" stroke="none" />
      <circle cx="3" cy="-9" r="1.2" fill="#1a1a1a" stroke="none" />
      <path d="M -1.5 -6 L 1.5 -6 L 0 -4 Z" fill="#1a1a1a" stroke="none" />
      <path d="M -3 -5 L -10 -4 M -3 -4 L -10 -2 M 3 -5 L 10 -4 M 3 -4 L 10 -2" stroke="#1a1a1a" strokeWidth="0.6" fill="none" />
    </g>
  );
}

function GlyphBear() {
  const fill = GLYPH_FILL;
  const stroke = GLYPH_STROKE;
  const sw = GLYPH_SW;
  return (
    <g fill={fill} stroke={stroke} strokeWidth={sw}>
      <circle cx="0" cy="-7" r="11" />
      <circle cx="-8" cy="-15" r="4" />
      <circle cx="8" cy="-15" r="4" />
      <circle cx="-8" cy="-15" r="2" fill="#1a1a1a" stroke="none" />
      <circle cx="8" cy="-15" r="2" fill="#1a1a1a" stroke="none" />
      <circle cx="-3" cy="-8" r="1.2" fill="#1a1a1a" stroke="none" />
      <circle cx="3" cy="-8" r="1.2" fill="#1a1a1a" stroke="none" />
      <ellipse cx="0" cy="-2" rx="5" ry="4" />
      <ellipse cx="0" cy="-3" rx="1.5" ry="1.1" fill="#1a1a1a" stroke="none" />
    </g>
  );
}

function GlyphWolf() {
  const fill = GLYPH_FILL;
  const stroke = GLYPH_STROKE;
  const sw = GLYPH_SW;
  return (
    <g fill={fill} stroke={stroke} strokeWidth={sw}>
      <path d="M -12 -2 L 0 -16 L 12 -2 L 8 8 L -8 8 Z" />
      <path d="M -8 -10 L -4 -18 L -2 -10 Z M 8 -10 L 4 -18 L 2 -10 Z" />
      <circle cx="-4" cy="-4" r="1.4" fill="#1a1a1a" stroke="none" />
      <circle cx="4" cy="-4" r="1.4" fill="#1a1a1a" stroke="none" />
      <path d="M -3 2 L 0 6 L 3 2 Z" fill="#1a1a1a" stroke="none" />
      <path d="M -2 4 L -1 8 L 0 5 L 1 8 L 2 4 Z" fill="#fff" stroke="#1a1a1a" strokeWidth="0.4" />
    </g>
  );
}

function GlyphDragon() {
  const fill = GLYPH_FILL;
  const stroke = GLYPH_STROKE;
  const sw = GLYPH_SW;
  return (
    <g fill={fill} stroke={stroke} strokeWidth={sw}>
      <path d="M -14 0 Q -10 -10 0 -10 Q 8 -10 12 -4 L 14 -2 L 12 2 L 8 0 Q 4 4 -4 4 Q -10 4 -14 0 Z" />
      <path d="M 4 -10 L 8 -16 L 10 -10 Z" />
      <circle cx="2" cy="-4" r="1.6" fill="#1a1a1a" stroke="none" />
      <path d="M -2 -2 Q -4 -16 -16 -14 Q -10 -8 -8 -4 Z" opacity="0.85" />
      <path d="M -14 2 Q -18 6 -12 10 L -10 8 Z" />
    </g>
  );
}

function GlyphDefault() {
  return <text textAnchor="middle" y="6" fontSize="20" fill={GLYPH_FILL}>&#9733;</text>;
}

const GLYPHS = {
  lion: GlyphLion,
  eagle: GlyphEagle,
  tiger: GlyphTiger,
  bear: GlyphBear,
  wolf: GlyphWolf,
  dragon: GlyphDragon,
};

/* ── Inline styles ───────────────────────────────────────────────── */

const glowKeyframes = `
@keyframes blazon-pulse {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-3px) scale(1.04); }
}
`;

const styleTag = (
  <style>{`
    ${glowKeyframes}
    .blazon--glow {
      filter: drop-shadow(0 0 12px rgba(243,201,105,0.85));
      animation: blazon-pulse 1.6s ease-in-out infinite;
    }
  `}</style>
);

/* ── Component ───────────────────────────────────────────────────── */

function Blazon({ team, size = 64, ring = true, glow = false }) {
  const { color = '#888888', blazonGlyph } = team || {};

  const colorLight = lighten(color, 0.35);
  const colorDark = darken(color, 0.3);
  const colorDarker = darken(color, 0.5);
  const colorBorder = lighten(color, 0.5);

  const uid = React.useId ? React.useId() : `blazon-${Math.random().toString(36).slice(2, 8)}`;
  const gradId = `bg-${uid}`;
  const shadowId = `shadow-${uid}`;
  const shineId = `shine-${uid}`;

  const GlyphComponent = GLYPHS[blazonGlyph] || GlyphDefault;

  const shieldPath =
    'M40 4 C 56 4 70 8 74 12 L 74 46 C 74 70 60 84 40 90 C 20 84 6 70 6 46 L 6 12 C 10 8 24 4 40 4 Z';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 80 92"
      width={size}
      height={size * (92 / 80)}
      className={glow ? 'blazon--glow' : undefined}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {styleTag}

      <defs>
        {/* Main gradient fill */}
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorLight} />
          <stop offset="100%" stopColor={colorDark} />
        </linearGradient>

        {/* Drop shadow */}
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.4)" />
        </filter>

        {/* Shine / gloss overlay gradient */}
        <linearGradient id={shineId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      {/* Shield with drop shadow */}
      <g filter={`url(#${shadowId})`}>
        {/* Base fill */}
        <path d={shieldPath} fill={`url(#${gradId})`} />

        {/* Darker bottom quartering chevron */}
        <clipPath id={`clip-${uid}`}>
          <path d={shieldPath} />
        </clipPath>
        <polygon
          points="0,50 40,35 80,50 80,92 0,92"
          fill={colorDarker}
          opacity="0.35"
          clipPath={`url(#clip-${uid})`}
        />

        {/* Animal glyph */}
        <g transform="translate(40 50)">
          <GlyphComponent />
        </g>

        {/* Shine / gloss overlay (top-left) */}
        <path
          d={shieldPath}
          fill={`url(#${shineId})`}
          opacity="0.6"
        />

        {/* Ring overlay */}
        {ring && (
          <path
            d={shieldPath}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="2"
          />
        )}

        {/* Border highlight stroke */}
        <path
          d={shieldPath}
          fill="none"
          stroke={colorBorder}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export default Blazon;
