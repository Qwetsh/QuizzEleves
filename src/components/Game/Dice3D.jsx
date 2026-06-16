const DICE_FACE_ROT = {
  1: { x: 0,    y: 0 },
  2: { x: 0,    y: -90 },
  3: { x: -90,  y: 0 },
  4: { x: 90,   y: 0 },
  5: { x: 0,    y: 90 },
  6: { x: 180,  y: 0 },
};

const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function PipPattern({ n }) {
  const active = new Set(PIPS[n] || []);
  return (
    <div className="dice3d-pips">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="dice3d-pip-cell">
          {active.has(i) ? <span className="dice3d-pip" /> : null}
        </div>
      ))}
    </div>
  );
}

function DiceFace({ pips, side, size, number }) {
  const half = size / 2;
  const transforms = {
    front:  `rotateY(0deg) translateZ(${half}px)`,
    back:   `rotateY(180deg) translateZ(${half}px)`,
    right:  `rotateY(90deg) translateZ(${half}px)`,
    left:   `rotateY(-90deg) translateZ(${half}px)`,
    top:    `rotateX(90deg) translateZ(${half}px)`,
    bottom: `rotateX(-90deg) translateZ(${half}px)`,
  };
  return (
    <div
      className="dice3d-face"
      style={{ width: size, height: size, transform: transforms[side] }}
    >
      {number != null
        ? <span style={{
            display: 'grid', placeItems: 'center', width: '100%', height: '100%',
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: size * 0.5, lineHeight: 1, color: 'inherit',
          }}>{number}</span>
        : <PipPattern n={pips} />}
    </div>
  );
}

export default function Dice3D({ value = 1, rolling = false, size = 96, onClick, disabled = false }) {
  // Au-delà d'un D6 (ex. D10 → 7..10), le cube à pips ne peut pas représenter la
  // face : on présente la face avant (rotation 0) avec le NOMBRE écrit.
  const numeric = value > 6;
  const target = numeric ? { x: 0, y: 0 } : (DICE_FACE_ROT[value] || DICE_FACE_ROT[1]);
  const spins = rolling ? 4 : 0;
  const rotX = target.x + spins * 360 + (rolling ? 720 : 0);
  const rotY = target.y + spins * 360 + (rolling ? -720 : 0);

  return (
    <div
      className={'dice3d-wrap ' + (rolling ? 'is-rolling ' : '') + (disabled ? 'is-disabled' : '')}
      style={{ width: size, height: size }}
      onClick={!disabled && !rolling ? onClick : undefined}
      role="button"
      aria-label={'D\u00e9, valeur ' + value}
    >
      <div className="dice3d-shadow" style={{ width: size * 0.85 }} />
      <div
        className="dice3d-cube"
        style={{
          width: size,
          height: size,
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transition: rolling
            ? 'transform 1100ms cubic-bezier(.18,.7,.34,1.02)'
            : 'transform 480ms cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        <DiceFace pips={1} side="front"  size={size} number={numeric ? value : null} />
        <DiceFace pips={6} side="back"   size={size} />
        <DiceFace pips={3} side="top"    size={size} />
        <DiceFace pips={4} side="bottom" size={size} />
        <DiceFace pips={2} side="right"  size={size} />
        <DiceFace pips={5} side="left"   size={size} />
      </div>
    </div>
  );
}
