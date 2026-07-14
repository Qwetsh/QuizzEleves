import { useT } from '../../i18n';
import FaceTile, { FaceModBadge } from './FaceTile';

const DICE_FACE_ROT = {
  1: { x: 0,    y: 0 },
  2: { x: 0,    y: -90 },
  3: { x: -90,  y: 0 },
  4: { x: 90,   y: 0 },
  5: { x: 0,    y: 90 },
  // Face 6 = côté « back » (rotateY(180)). On l'amène au premier plan par
  // rotateY(180) — et NON rotateX(180) — sinon la composition avec le rotateY
  // de la face donne une rotation de 180° dans le plan (contenu à l'envers).
  6: { x: 0,    y: 180 },
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

// Transforms des 6 côtés du cube pour une demi-arête donnée (px depuis le centre).
const SIDE_TRANSFORM = (half) => ({
  front:  `rotateY(0deg) translateZ(${half}px)`,
  back:   `rotateY(180deg) translateZ(${half}px)`,
  right:  `rotateY(90deg) translateZ(${half}px)`,
  left:   `rotateY(-90deg) translateZ(${half}px)`,
  top:    `rotateX(90deg) translateZ(${half}px)`,
  bottom: `rotateX(-90deg) translateZ(${half}px)`,
});

function DiceFace({ pips, side, size, number, face, mod }) {
  const transforms = SIDE_TRANSFORM(size / 2);
  return (
    <div
      className="dice3d-face"
      style={{ width: size, height: size, transform: transforms[side] }}
    >
      {face
        ? <FaceTile face={face} size={size} flat mod={mod} />
        : number != null
        ? <span style={{
            display: 'grid', placeItems: 'center', width: '100%', height: '100%',
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: size * 0.5, lineHeight: 1, color: 'inherit',
          }}>{number}</span>
        : <PipPattern n={pips} />}
      {/* Marque de Magie sur un dé NON forgé (pips/nombre) : badge posé
          directement sur la face — FaceTile s'en charge pour un dé forgé. */}
      {!face && <FaceModBadge mod={mod} style={{ fontSize: size * 0.2 }} />}
    </div>
  );
}

export default function Dice3D({ value = 1, rolling = false, size = 96, onClick, disabled = false, faces = null, faceMods = null, idleSpin = false }) {
  const T = useT();
  // Dé personnalisé (Forge) : chaque face du cube porte sa face forgée. Sinon,
  // au-delà d'un D6 (legacy), on écrit le nombre sur la face avant.
  const f = Array.isArray(faces) && faces.length === 6 ? faces : null;
  // Faces bénies/maudites (Magie) : marques par SLOT 1..6 (team.faceMods),
  // passées par les appelants qui affichent le dé D'UNE ÉQUIPE.
  const m = faceMods || {};
  const numeric = !f && value > 6;
  const target = numeric ? { x: 0, y: 0 } : (DICE_FACE_ROT[value] || DICE_FACE_ROT[1]);
  const spins = rolling ? 4 : 0;
  const rotX = target.x + spins * 360 + (rolling ? 720 : 0);
  const rotY = target.y + spins * 360 + (rolling ? -720 : 0);
  // Rotation continue « vitrine » (Forge) : tant qu'on ne lance pas, le cube tumble
  // en boucle pour exposer le dé propre à l'équipe. Pilotée par CSS (.is-idle) ; on
  // n'impose alors aucun transform inline pour ne pas brider l'animation.
  const idle = idleSpin && !rolling;

  return (
    <div
      className={'dice3d-wrap ' + (rolling ? 'is-rolling ' : '') + (disabled ? 'is-disabled' : '')}
      style={{ width: size, height: size }}
      onClick={!disabled && !rolling ? onClick : undefined}
      role="button"
      aria-label={T('game.dieValue', { value })}
    >
      <div className="dice3d-shadow" style={{ width: size * 0.85 }} />
      <div
        className={'dice3d-cube' + (idle ? ' is-idle' : '')}
        style={{
          width: size,
          height: size,
          ...(idle ? {} : {
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
            transition: rolling
              ? 'transform 1100ms cubic-bezier(.18,.7,.34,1.02)'
              : 'transform 480ms cubic-bezier(.34,1.56,.64,1)',
          }),
        }}
      >
        <DiceFace pips={1} side="front"  size={size} number={numeric ? value : null} face={f ? f[0] : null} mod={m[1]} />
        <DiceFace pips={6} side="back"   size={size} face={f ? f[5] : null} mod={m[6]} />
        <DiceFace pips={3} side="top"    size={size} face={f ? f[2] : null} mod={m[3]} />
        <DiceFace pips={4} side="bottom" size={size} face={f ? f[3] : null} mod={m[4]} />
        <DiceFace pips={2} side="right"  size={size} face={f ? f[1] : null} mod={m[2]} />
        <DiceFace pips={5} side="left"   size={size} face={f ? f[4] : null} mod={m[5]} />
      </div>
    </div>
  );
}
