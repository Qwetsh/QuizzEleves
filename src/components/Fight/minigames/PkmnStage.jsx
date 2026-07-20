// Scène de combat Pokémon PARTAGÉE (arène + dresseurs + sprites + boîtes PV +
// dialogue + VFX d'attaque directionnels) — consommée par PokemonBattleGame
// (tactile) et PkmnDuelStage (TV du mode téléphones). Purement
// présentationnelle : tout vient des props.
//
// `view`     = { A: { active, fighters: [{ name, sprite, hp, maxHp, status,
//              boosts, ko }] }, B: … } (vue d'affichage, pas le moteur).
// `anim`     = { lunge?|hit?|faint?|cast?|recall?: side, enter?: side|'both' }
//              recall = rayon rouge d'aspiration dans la ball ; enter = lancer
//              de pokéball + matérialisation (silhouette blanche → sprite).
//              Un combattant `ko` sans anim est CACHÉ (seul le dresseur reste).
// `vfx`      = { archetype, type, from, side, seq } — animation d'attaque qui
//              part du camp `from` VERS le camp `side` (cf. logic/pkmnAnimMap).
// `trainers` = { A: { character, color }, B: … } — personnage pixel-art de
//              chaque équipe, écharpe teintée couleur d'équipe (filtre SVG
//              multiply, même technique que les pions du plateau).
//
// ⚠️ Déterminisme : AUCUN Math.random()/Date.now() — toutes les particules
// sont dérivées de (index, vfx.seq). ⚠️ 60 fps : translate/scale/rotate/
// opacity/filter uniquement (longhands → la transform statique scaleX(-1) des
// sprites reste composée avec les animations).

import { characterById } from '../../../data/characters';

const STAT_FR = { atk: 'Atq', def: 'Déf', spc: 'Spé', spe: 'Vit' };
const AILMENT_TAG = { par: 'PAR', psn: 'PSN', slp: 'SOM' };

// Centres visuels (en % de la scène) : Pokémon actifs + poitrail des dresseurs.
// Les distances de trajet des VFX sont exprimées en cqw/cqh (unités de
// container query) → la direction reste juste quel que soit le format.
const ANCHOR = { A: { x: 21, y: 63 }, B: { x: 79, y: 37 } };
const TRAINER_PT = { A: { x: 5.5, y: 70 }, B: { x: 94.5, y: 42 } };

// Couleur de halo par type d'attaque (15 types Gén. 1).
const TYPE_GLOW = {
  fire: '#ff7a2f', water: '#4aa8ff', grass: '#57c84d', bug: '#a8b820',
  electric: '#ffd93b', ice: '#9ce4f2', fighting: '#e06030', normal: '#e8e0c8',
  ground: '#c9a25a', rock: '#b8a038', poison: '#a86bc9', psychic: '#f85888',
  ghost: '#8a6fc0', dragon: '#7a5cf0', flying: '#a890f0',
};

export const PKMN_STAGE_CSS = `
@keyframes pkmnLungeL { 0% { translate: 0 0; } 40% { translate: 46px -14px; } 100% { translate: 0 0; } }
@keyframes pkmnLungeR { 0% { translate: 0 0; } 40% { translate: -46px 14px; } 100% { translate: 0 0; } }
@keyframes pkmnHit { 0%, 100% { filter: none; translate: 0 0; } 25% { filter: brightness(3); translate: -7px 0; } 50% { filter: brightness(0.6); translate: 7px 0; } 75% { filter: brightness(2); translate: -4px 0; } }
@keyframes pkmnFaint { to { translate: 0 40px; opacity: 0; } }
@keyframes pkmnCast { 0%, 100% { scale: 1; } 40% { scale: 1.08; filter: brightness(1.6) drop-shadow(0 0 12px rgba(255,255,255,0.7)); } }
@keyframes pkmnMaterialize {
  0% { opacity: 0; scale: 0.12; filter: brightness(0) invert(1) drop-shadow(0 0 16px #fff); }
  45% { opacity: 1; scale: 1.08; filter: brightness(0) invert(1) drop-shadow(0 0 12px #fff); }
  72% { scale: 1; filter: brightness(0) invert(1) drop-shadow(0 0 6px #fff); }
  100% { opacity: 1; scale: 1; filter: none; }
}
@keyframes pkmnRecall {
  0% { opacity: 0.95; filter: sepia(1) saturate(9) hue-rotate(-45deg) brightness(1.5) drop-shadow(0 0 10px #ff4040); }
  100% { translate: var(--rx) var(--ry); scale: 0.04; opacity: 0; filter: sepia(1) saturate(9) hue-rotate(-45deg) brightness(2.2); }
}
@keyframes pkmnBallArc {
  0% { translate: var(--bx0) var(--by0); rotate: 0turn; opacity: 1; }
  18% { translate: calc(var(--bx0) * 0.62) calc(var(--by0) * 0.62 - 11cqh); rotate: 0.9turn; }
  40% { translate: 0 0; rotate: 2turn; }
  54% { translate: 0 -4cqh; rotate: 2.3turn; }
  68%, 86% { translate: 0 0; rotate: 2.5turn; opacity: 1; }
  100% { translate: 0 0; rotate: 2.5turn; opacity: 0; }
}
@keyframes pkmnBallFlash { 0% { opacity: 0; scale: 0.2; } 30% { opacity: 0.95; } 100% { opacity: 0; scale: 2.6; } }
@keyframes pkmnTrainerBob { 0%, 100% { translate: 0 0; } 50% { translate: 0 -5px; } }
@keyframes pkmnThrow { 0%, 100% { rotate: 0deg; } 30% { rotate: var(--lean); } 60% { rotate: calc(var(--lean) * -0.45); } }
@keyframes pkmnShake { 0%, 100% { transform: translate(0, 0); } 20% { transform: translate(-9px, 3px); } 40% { transform: translate(8px, -3px); } 60% { transform: translate(-6px, 2px); } 80% { transform: translate(5px, -2px); } }
@keyframes pkmnVfxGlow { 0% { opacity: 0; scale: 0.3; } 35% { opacity: 0.85; } 100% { opacity: 0; scale: 1.6; } }
@keyframes pkmnVfxPart {
  0% { translate: 0 0; scale: 0.4; opacity: 0; }
  12% { opacity: 1; }
  100% { translate: var(--dx) var(--dy); scale: 1.2; rotate: var(--rot, 0deg); opacity: 0; }
}
@keyframes pkmnWave {
  0% { translate: 0 0; scale: 0.4; opacity: 0; }
  16% { opacity: 1; }
  60% { scale: 1; }
  88% { opacity: 0.95; }
  100% { translate: var(--dx) var(--dy); scale: 1.3; opacity: 0; }
}
@keyframes pkmnBeamOrb { 0% { scale: 0.2; opacity: 0; } 28% { opacity: 1; scale: 1; } 74% { opacity: 0.95; } 100% { scale: 1.5; opacity: 0; } }
@keyframes pkmnProjArc {
  0% { translate: 0 0; scale: 0.5; rotate: 0deg; opacity: 0; }
  10% { opacity: 1; }
  50% { translate: calc(var(--dx) * 0.5) calc(var(--dy) * 0.5 - 9cqh); }
  90% { opacity: 1; }
  100% { translate: var(--dx) var(--dy); scale: 1.05; rotate: var(--spin, 540deg); opacity: 0; }
}
@keyframes pkmnRise {
  0% { translate: 0 0; scale: 0.35; opacity: 0; }
  20% { opacity: 1; }
  100% { translate: var(--dx, 0px) var(--dy); scale: 1.1; opacity: 0; }
}
@keyframes pkmnBolt {
  0% { scale: 1 0; opacity: 0; }
  14% { opacity: 1; scale: 1 1; }
  40% { opacity: 0.95; }
  55% { opacity: 0.35; }
  70% { opacity: 0.9; }
  100% { scale: 1 1; opacity: 0; }
}
@keyframes pkmnFlash { 0% { opacity: 0; } 30% { opacity: 0.5; } 100% { opacity: 0; } }
@keyframes pkmnDebris {
  0% { translate: 0 0; rotate: 0deg; opacity: 0; }
  10% { opacity: 1; }
  45% { translate: var(--dx) var(--dy); rotate: var(--rot); }
  75% { translate: calc(var(--dx) * 1.25) 1cqh; }
  100% { translate: calc(var(--dx) * 1.4) 1.6cqh; rotate: var(--rot); opacity: 0; }
}
@keyframes pkmnSpore {
  0% { translate: 0 0; scale: 0.5; opacity: 0; }
  12% { opacity: 1; }
  30% { translate: calc(var(--dx) * 0.3) calc(var(--dy) * 0.3 - 3.5cqh); }
  55% { translate: calc(var(--dx) * 0.62) calc(var(--dy) * 0.62 + 2cqh); scale: 1; }
  85% { opacity: 0.9; }
  100% { translate: var(--dx) var(--dy); scale: 0.8; opacity: 0; }
}
@keyframes pkmnRing { 0% { scale: 0.15; opacity: 0.9; } 100% { scale: 1.7; opacity: 0; } }
@keyframes pkmnDrainOrb {
  0% { translate: 0 0; scale: 0.3; opacity: 0; }
  18% { opacity: 1; scale: 1; }
  100% { translate: var(--dx) var(--dy); scale: 0.55; opacity: 0; }
}
@keyframes pkmnDrop {
  0% { translate: 0 -8cqh; opacity: 0; }
  25% { opacity: 1; }
  80% { opacity: 0.85; }
  100% { translate: 0 3cqh; opacity: 0; }
}
@keyframes pkmnSpike { 0% { scale: 0 1; opacity: 0; } 30% { opacity: 1; scale: 1 1; } 100% { scale: 1.15 1; opacity: 0; } }
@keyframes pkmnSlashCut { 0% { scale: 0 1; opacity: 0; } 22% { opacity: 1; scale: 1 1; } 70% { opacity: 0.9; } 100% { scale: 1.05 1; opacity: 0; } }
`;

// ── Petits helpers de rendu VFX (déterministes : index + seq) ───────────────
const at = (p) => ({ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: 0, height: 0 });
const jit = (i, seq, m) => (i * 53 + seq * 29) % m; // pseudo-aléa stable

function ImpactGlow({ p, glow, delay = 0, size = 120 }) {
  return (
    <div style={at(p)}>
      <div style={{
        position: 'absolute', left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: '50%',
        background: `radial-gradient(circle, ${glow}cc 0%, ${glow}55 45%, transparent 70%)`,
        animation: `pkmnVfxGlow 520ms ease-out ${delay}ms both`,
      }} />
    </div>
  );
}

// Éclats radiaux à l'impact (petits disques colorés projetés autour du point).
function Specks({ p, glow, seq, n = 8, delay = 0, spread = 52, up = 0 }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const a = ((i * 137 + seq * 61) % 360) * (Math.PI / 180);
        const d = spread * 0.6 + jit(i, seq, spread);
        const s = 6 + jit(i + 3, seq, 6);
        return (
          <div key={i} style={at(p)}>
            <div style={{
              position: 'absolute', left: -s / 2, top: -s / 2, width: s, height: s, borderRadius: '50%',
              background: `radial-gradient(circle, #fff 0 30%, ${glow} 70%)`, boxShadow: `0 0 6px ${glow}`,
              '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d - up}px`,
              animation: `pkmnVfxPart 520ms ease-out ${delay + (i % 4) * 40}ms both`,
            }} />
          </div>
        );
      })}
    </>
  );
}

// ── Archétypes d'animation d'attaque ────────────────────────────────────────
// ctx = { seq, glow, type, src, dst, dx, dy } (dx/dy en unités % → cqw/cqh)
const ARCH_RENDER = {
  // Vague d'eau qui déferle du lanceur sur la cible.
  wave: ({ src, dst, dx, dy, seq }) => (
    <>
      <div style={at(src)}>
        <div style={{
          position: 'absolute', left: '-9cqw', top: '-13cqh', width: '18cqw', height: '15cqh',
          borderRadius: '55% 45% 42% 46% / 72% 62% 30% 34%',
          background: 'linear-gradient(180deg, #f2fbff 0%, #a8dcf8 24%, #4aa8ff 56%, #1b5fa8 100%)',
          boxShadow: '0 0 18px rgba(74,168,255,0.65), inset 0 6px 0 rgba(255,255,255,0.55)',
          '--dx': `${dx}cqw`, '--dy': `${dy}cqh`,
          animation: 'pkmnWave 680ms cubic-bezier(.5,.1,.8,.5) both',
        }}>
          {/* Écume sur la crête */}
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${8 + i * 20 + jit(i, seq, 7)}%`, top: `${-4 + (i % 2) * 6}%`,
              width: 9 + jit(i, seq, 5), height: 9 + jit(i, seq, 5), borderRadius: '50%', background: '#fff', opacity: 0.9,
            }} />
          ))}
        </div>
      </div>
      <ImpactGlow p={dst} glow="#4aa8ff" delay={600} size={130} />
      <Specks p={dst} glow="#a8dcf8" seq={seq} n={10} delay={600} spread={58} up={26} />
    </>
  ),

  // Rayon continu : chaîne d'orbes lumineuses qui s'allument du lanceur à la cible.
  beam: ({ src, dst, dx, dy, glow, seq }) => (
    <>
      {Array.from({ length: 12 }, (_, i) => {
        const t = i / 11;
        const s = 11 + t * 15 + jit(i, seq, 5);
        return (
          <div key={i} style={at({ x: src.x + dx * t, y: src.y + dy * t })}>
            <div style={{
              position: 'absolute', left: -s / 2, top: -s / 2, width: s, height: s, borderRadius: '50%',
              background: `radial-gradient(circle, #fff 0 26%, ${glow} 62%, transparent 76%)`,
              boxShadow: `0 0 14px ${glow}`,
              animation: `pkmnBeamOrb 620ms linear ${i * 30}ms both`,
            }} />
          </div>
        );
      })}
      <ImpactGlow p={dst} glow={glow} delay={470} size={125} />
      <Specks p={dst} glow={glow} seq={seq} n={8} delay={520} spread={50} up={18} />
    </>
  ),

  // Projectile(s) en arc (dards, feuilles, bulles, œufs, météores…).
  projectile: ({ src, dst, dx, dy, glow, type, seq }) => {
    const n = type === 'water' ? 5 : 3;
    const shape = (i) => {
      const s = 15 + jit(i, seq, 7);
      const base = { position: 'absolute', left: -s / 2, top: -s / 2, width: s, height: s };
      if (type === 'grass' || type === 'bug') {
        return { ...base, borderRadius: '0 70% 0 70%', background: 'linear-gradient(135deg, #b8ef8f, #3fae42)', boxShadow: '0 0 6px #57c84d' };
      }
      if (type === 'water') {
        return { ...base, borderRadius: '50%', border: '2px solid #dff2ff', background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95) 0 22%, rgba(124,196,245,0.55) 70%)' };
      }
      if (type === 'poison') {
        return { ...base, borderRadius: '50% 50% 62% 38%', background: 'radial-gradient(circle at 40% 35%, #d9a8f0, #7a3fa0)', boxShadow: '0 0 8px #a86bc9' };
      }
      return { ...base, borderRadius: '50%', background: `radial-gradient(circle at 40% 35%, #fff, ${glow})`, boxShadow: `0 0 10px ${glow}` };
    };
    return (
      <>
        {Array.from({ length: n }, (_, i) => (
          <div key={i} style={at(src)}>
            <div style={{
              ...shape(i),
              '--dx': `${dx + (jit(i, seq, 9) - 4)}cqw`, '--dy': `${dy + (jit(i + 2, seq, 7) - 3)}cqh`,
              '--spin': `${360 + jit(i, seq, 360)}deg`,
              animation: `pkmnProjArc 620ms cubic-bezier(.45,.1,.8,.6) ${i * 110}ms both`,
            }} />
          </div>
        ))}
        <ImpactGlow p={dst} glow={glow} delay={560} size={110} />
        <Specks p={dst} glow={glow} seq={seq} n={7} delay={600} spread={46} up={16} />
      </>
    );
  },

  // Boule de feu puis colonnes de flammes qui montent sur la cible.
  flames: ({ src, dst, dx, dy, seq }) => (
    <>
      <div style={at(src)}>
        <div style={{
          position: 'absolute', left: -13, top: -13, width: 26, height: 26, borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 35%, #ffe89a 0 28%, #ff8a2f 62%, #d84020 100%)',
          boxShadow: '0 0 18px #ff7a2f',
          '--dx': `${dx}cqw`, '--dy': `${dy}cqh`, '--spin': '260deg',
          animation: 'pkmnProjArc 500ms cubic-bezier(.45,.1,.8,.6) both',
        }} />
      </div>
      {Array.from({ length: 7 }, (_, i) => {
        const ox = jit(i, seq, 52) - 26;
        return (
          <div key={i} style={at(dst)}>
            <div style={{
              position: 'absolute', left: ox - 7, top: -8, width: 14, height: 24,
              borderRadius: '50% 50% 50% 50% / 64% 64% 36% 36%',
              background: 'linear-gradient(180deg, #ffe89a 0%, #ffab3d 45%, #ff5a2f 80%, #c92f1f 100%)',
              boxShadow: '0 0 10px #ff7a2f',
              '--dx': `${ox / 9}px`, '--dy': '-9cqh',
              animation: `pkmnRise 560ms ease-out ${460 + (i % 5) * 70}ms both`,
            }} />
          </div>
        );
      })}
      <ImpactGlow p={dst} glow="#ff7a2f" delay={480} size={130} />
    </>
  ),

  // Éclair qui tombe du ciel sur la cible + flash blanc.
  bolt: ({ dst, glow, seq }) => (
    <>
      <div style={{ position: 'absolute', inset: 0, background: '#fff', mixBlendMode: 'screen', animation: 'pkmnFlash 360ms ease-out 300ms both' }} />
      <div style={at({ x: dst.x, y: 0 })}>
        <div style={{
          position: 'absolute', left: '-3cqw', top: 0, width: '6cqw', height: `${dst.y}cqh`,
          background: 'linear-gradient(180deg, #fff 0%, #ffe36b 40%, #ffd93b 100%)',
          clipPath: 'polygon(45% 0, 62% 0, 50% 30%, 70% 28%, 42% 62%, 60% 60%, 30% 100%, 44% 64%, 26% 66%, 48% 32%, 30% 34%)',
          filter: 'drop-shadow(0 0 10px #ffd93b)', transformOrigin: '50% 0',
          animation: 'pkmnBolt 420ms linear 260ms both',
        }} />
      </div>
      <ImpactGlow p={dst} glow={glow} delay={480} size={130} />
      <Specks p={dst} glow="#ffd93b" seq={seq} n={9} delay={540} spread={54} up={20} />
    </>
  ),

  // Séisme : débris + poussière au sol (la secousse d'arène est gérée par la scène).
  quake: ({ dst, seq }) => (
    <>
      {Array.from({ length: 6 }, (_, i) => {
        const s = 10 + jit(i, seq, 8);
        return (
          <div key={i} style={at({ x: dst.x, y: dst.y + 6 })}>
            <div style={{
              position: 'absolute', left: -s / 2, top: -s / 2, width: s, height: s * 0.85,
              borderRadius: '28% 40% 30% 42%', background: 'linear-gradient(150deg, #cfae66, #8a6a34)',
              boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.3)',
              '--dx': `${jit(i, seq, 60) - 30}px`, '--dy': '-6cqh', '--rot': `${jit(i, seq, 200) - 100}deg`,
              animation: `pkmnDebris 640ms ease-out ${300 + (i % 4) * 70}ms both`,
            }} />
          </div>
        );
      })}
      {Array.from({ length: 4 }, (_, i) => (
        <div key={`d${i}`} style={at({ x: dst.x + jit(i, seq, 10) - 5, y: dst.y + 7 })}>
          <div style={{
            position: 'absolute', left: -30, top: -30, width: 60, height: 60, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(183,169,138,0.75) 0%, rgba(183,169,138,0.3) 50%, transparent 72%)',
            animation: `pkmnVfxGlow 600ms ease-out ${340 + i * 90}ms both`,
          }} />
        </div>
      ))}
    </>
  ),

  // Balafres tranchantes sur la cible.
  slash: ({ dst, glow, seq }) => (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} style={at(dst)}>
          <div style={{
            position: 'absolute', left: -62, top: -32 + i * 24, width: 128, height: 5, borderRadius: 4,
            background: `linear-gradient(90deg, transparent, #fff 30%, ${glow} 70%, transparent)`,
            transform: `rotate(${-38 + i * 6}deg)`, transformOrigin: '8% 50%',
            boxShadow: `0 0 8px ${glow}`,
            animation: `pkmnSlashCut 320ms cubic-bezier(.7,0,.3,1) ${380 + i * 90}ms both`,
          }} />
        </div>
      ))}
      <ImpactGlow p={dst} glow={glow} delay={520} size={105} />
      <Specks p={dst} glow={glow} seq={seq} n={6} delay={560} spread={42} up={14} />
    </>
  ),

  // Ruée physique : étoile d'impact au moment du contact.
  charge: ({ dst, glow, seq }) => (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={at(dst)}>
          <div style={{
            position: 'absolute', left: 0, top: -2, width: 46 + jit(i, seq, 22), height: 4, borderRadius: 3,
            background: `linear-gradient(90deg, #fff, ${glow})`,
            transform: `rotate(${i * 45 + (seq * 37) % 28}deg)`, transformOrigin: '0 50%',
            animation: `pkmnSpike 340ms ease-out ${480 + (i % 4) * 30}ms both`,
          }} />
        </div>
      ))}
      <ImpactGlow p={dst} glow={glow} delay={470} size={110} />
      <Specks p={dst} glow={glow} seq={seq} n={7} delay={520} spread={46} up={14} />
    </>
  ),

  // Nuage de spores / poison qui dérive du lanceur vers la cible.
  spores: ({ src, dst, dx, dy, type, seq }) => {
    const pal = type === 'poison' ? ['#c98ae0', '#a86bc9', '#8a4fb0'] : ['#b8ef8f', '#e0e07a', '#7ac06a'];
    return (
      <>
        {Array.from({ length: 9 }, (_, i) => {
          const s = 7 + jit(i, seq, 6);
          return (
            <div key={i} style={at(src)}>
              <div style={{
                position: 'absolute', left: -s / 2, top: -s / 2, width: s, height: s, borderRadius: '50%',
                background: pal[i % pal.length], boxShadow: `0 0 6px ${pal[i % pal.length]}`, opacity: 0.9,
                '--dx': `${dx + (jit(i, seq, 14) - 7)}cqw`, '--dy': `${dy + (jit(i + 4, seq, 10) - 5)}cqh`,
                animation: `pkmnSpore 950ms ease-in-out ${i * 70}ms both`,
              }} />
            </div>
          );
        })}
        <ImpactGlow p={dst} glow={pal[0]} delay={800} size={95} />
      </>
    );
  },

  // Anneaux psychiques concentriques sur la cible.
  psy: ({ dst, glow, seq }) => (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} style={at(dst)}>
          <div style={{
            position: 'absolute', left: -42, top: -42, width: 84, height: 84, borderRadius: '50%',
            border: `3px solid ${glow}`, boxShadow: `0 0 12px ${glow}, inset 0 0 10px ${glow}66`,
            animation: `pkmnRing 560ms ease-out ${170 + i * 150}ms both`,
          }} />
        </div>
      ))}
      <ImpactGlow p={dst} glow={glow} delay={340} size={120} />
      <Specks p={dst} glow={glow} seq={seq} n={5} delay={520} spread={36} up={12} />
    </>
  ),

  // Drain : orbes vertes aspirées de la cible VERS le lanceur.
  drain: ({ src, dst, dx, dy, seq }) => (
    <>
      <ImpactGlow p={dst} glow="#57c84d" delay={280} size={100} />
      {Array.from({ length: 6 }, (_, i) => {
        const s = 9 + jit(i, seq, 5);
        return (
          <div key={i} style={at(dst)}>
            <div style={{
              position: 'absolute', left: -s / 2, top: -s / 2, width: s, height: s, borderRadius: '50%',
              background: 'radial-gradient(circle, #eaffd0 0 30%, #57c84d 70%)', boxShadow: '0 0 10px #57c84d',
              '--dx': `${-dx + (jit(i, seq, 8) - 4)}cqw`, '--dy': `${-dy + (jit(i + 3, seq, 6) - 3)}cqh`,
              animation: `pkmnDrainOrb 640ms ease-in ${330 + i * 90}ms both`,
            }} />
          </div>
        );
      })}
      <ImpactGlow p={src} glow="#9be67f" delay={880} size={95} />
      <Specks p={src} glow="#c8f5a8" seq={seq} n={6} delay={900} spread={36} up={22} />
    </>
  ),

  // Aura de renforcement sur soi : anneau + étincelles montantes.
  buff: ({ dst, glow, seq }) => (
    <>
      <div style={at(dst)}>
        <div style={{
          position: 'absolute', left: -48, top: -48, width: 96, height: 96, borderRadius: '50%',
          border: `3px solid ${glow}`, boxShadow: `0 0 14px ${glow}`,
          animation: 'pkmnRing 640ms ease-out 80ms both',
        }} />
      </div>
      {Array.from({ length: 8 }, (_, i) => {
        const s = 9 + jit(i, seq, 5);
        return (
          <div key={i} style={at({ x: dst.x, y: dst.y + 4 })}>
            <div style={{
              position: 'absolute', left: (jit(i, seq, 56) - 28) - s / 2, top: -s / 2, width: s, height: s,
              clipPath: 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)',
              background: `linear-gradient(180deg, #fff, ${glow})`, filter: `drop-shadow(0 0 6px ${glow})`,
              '--dy': '-13cqh', '--dx': `${(jit(i, seq, 12) - 6)}px`,
              animation: `pkmnRise 780ms ease-out ${i * 80}ms both`,
            }} />
          </div>
        );
      })}
      <ImpactGlow p={dst} glow={glow} delay={120} size={115} />
    </>
  ),

  // Affaiblissement : chevrons descendants + voile sombre sur la cible.
  debuff: ({ dst, seq }) => (
    <>
      <div style={at(dst)}>
        <div style={{
          position: 'absolute', left: -46, top: -46, width: 92, height: 92, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(90,40,110,0.55) 0%, rgba(90,40,110,0.25) 50%, transparent 72%)',
          animation: 'pkmnVfxGlow 640ms ease-out 180ms both',
        }} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={at({ x: dst.x + (i - 1) * 5, y: dst.y - 6 })}>
          <div style={{
            position: 'absolute', left: -13, top: -10, width: 26, height: 20,
            clipPath: 'polygon(0 0, 50% 40%, 100% 0, 100% 45%, 50% 90%, 0 45%)',
            background: 'linear-gradient(180deg, #e05a7a, #8a2f4f)', filter: 'drop-shadow(0 0 5px #d84965)',
            animation: `pkmnDrop 620ms ease-in ${140 + i * 130 + jit(i, seq, 40)}ms both`,
          }} />
        </div>
      ))}
    </>
  ),

  // Notes de musique qui flottent vers la cible (berceuses).
  notes: ({ src, dx, dy, seq }) => (
    <>
      {['♪', '♫', '♪', '♬'].map((g, i) => (
        <div key={i} style={at(src)}>
          <span style={{
            position: 'absolute', left: -9, top: -12, fontSize: 19 + jit(i, seq, 6), lineHeight: 1,
            color: '#e8b4f0', textShadow: '0 0 8px #c98ae0, 0 2px 2px rgba(0,0,0,0.4)',
            '--dx': `${dx + (jit(i, seq, 12) - 6)}cqw`, '--dy': `${dy + (jit(i + 2, seq, 8) - 4)}cqh`,
            animation: `pkmnSpore 1000ms ease-in-out ${i * 160}ms both`, display: 'inline-block',
          }}>
            {g}
          </span>
        </div>
      ))}
    </>
  ),
};

// Couche VFX d'une attaque : résout lanceur/cible et rend l'archétype.
function VfxLayer({ vfx }) {
  const { archetype, type, from = 'A', side = 'B', seq = 0 } = vfx;
  const glow = TYPE_GLOW[type] || TYPE_GLOW.normal;
  const src = ANCHOR[from] || ANCHOR.A;
  const dst = ANCHOR[side] || ANCHOR.B;
  const ctx = { seq, glow, type, src, dst, dx: dst.x - src.x, dy: dst.y - src.y };
  const render = ARCH_RENDER[archetype] || ARCH_RENDER.charge;
  return (
    <div key={seq} style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none' }}>
      {render(ctx)}
    </div>
  );
}

// ── Pokéball (lancer d'entrée) + rayon rouge de rappel ──────────────────────
const BALL_SPOT = { A: { left: '19%', bottom: '21%' }, B: { left: '78.5%', bottom: '51%' } };

function PokeBall({ side }) {
  const left = side === 'A';
  return (
    <div style={{ position: 'absolute', ...BALL_SPOT[side], width: 0, height: 0, zIndex: 3, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', left: -12, top: -24, width: 24, height: 24, borderRadius: '50%',
        background: 'linear-gradient(180deg, #e8342c 0 44%, #1a1a1a 44% 56%, #f4f4f4 56%)',
        border: '2px solid #1a1a1a', boxShadow: '0 3px 5px rgba(0,0,0,0.4)',
        '--bx0': left ? '-15cqw' : '15cqw', '--by0': '-3cqh',
        animation: 'pkmnBallArc 700ms ease-in both',
      }}>
        <div style={{
          position: 'absolute', left: '50%', top: '50%', width: 8, height: 8, marginLeft: -4, marginTop: -4,
          borderRadius: '50%', background: '#f4f4f4', border: '2px solid #1a1a1a', boxSizing: 'border-box',
        }} />
      </div>
      {/* Flash blanc d'ouverture */}
      <div style={{
        position: 'absolute', left: -45, top: -55, width: 90, height: 90, borderRadius: '50%',
        background: 'radial-gradient(circle, #fff 0 35%, rgba(255,255,255,0.5) 60%, transparent 75%)',
        animation: 'pkmnBallFlash 480ms ease-out 600ms both',
      }} />
    </div>
  );
}

// Rayon rouge de rappel : orbes rouges aspirées du Pokémon vers le dresseur.
function RecallFx({ side }) {
  const from = ANCHOR[side];
  const to = TRAINER_PT[side];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
      {Array.from({ length: 5 }, (_, i) => {
        const t = i / 4;
        const s = 14 - i * 2;
        return (
          <div key={i} style={at({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })}>
            <div style={{
              position: 'absolute', left: -s / 2, top: -s / 2, width: s, height: s, borderRadius: '50%',
              background: 'radial-gradient(circle, #ffd0d0 0 30%, #ff4040 70%, transparent 80%)',
              boxShadow: '0 0 12px #ff4040',
              animation: `pkmnBeamOrb 460ms linear ${i * 45}ms both`,
            }} />
          </div>
        );
      })}
    </div>
  );
}

// ── Dresseur (personnage pixel-art, écharpe teintée couleur d'équipe) ───────
const colorSlug = (c) => (c || '').replace(/[^a-zA-Z0-9]/g, '');

function Trainer({ side, trainer, gesture }) {
  const char = characterById(trainer?.character);
  if (!char) return null;
  const left = side === 'A';
  const color = trainer.color || '#888888';
  const fid = `pkst-scarf-${side}-${colorSlug(color)}`;
  return (
    <svg
      viewBox="0 0 68 76"
      style={{
        position: 'absolute',
        ...(left ? { left: '1%', bottom: '12.5%' } : { right: '1%', bottom: '42.5%' }),
        height: left ? '23%' : '19.5%', zIndex: 2, overflow: 'visible', pointerEvents: 'none',
        filter: 'drop-shadow(0 4px 5px rgba(0,0,0,0.35))',
        transformOrigin: '50% 100%',
        '--lean': left ? '-11deg' : '11deg',
        animation: gesture
          ? 'pkmnThrow 600ms ease'
          : `pkmnTrainerBob 3.2s ease-in-out infinite ${left ? '0s' : '-1.6s'}`,
      }}
    >
      <defs>
        <filter id={fid} colorInterpolationFilters="sRGB">
          <feFlood floodColor={color} result="flood" />
          <feComposite in="flood" in2="SourceGraphic" operator="in" result="tint" />
          <feBlend in="tint" in2="SourceGraphic" mode="multiply" />
        </filter>
      </defs>
      {/* Sprites dessinés tournés vers la gauche → le camp gauche est miroité
          pour faire face à son Pokémon (comme les pions du plateau). */}
      <g transform={left ? 'translate(68 0) scale(-1 1)' : undefined}>
        <image href={char.body} x="0" y="0" width="68" height="76" preserveAspectRatio="xMidYMax meet" />
        {char.scarf && (
          <image href={char.scarf} x="0" y="0" width="68" height="76" preserveAspectRatio="xMidYMax meet" filter={`url(#${fid})`} />
        )}
      </g>
    </svg>
  );
}

// ── Scène ───────────────────────────────────────────────────────────────────
// `spriteScale` : facteur de taille des Pokémon actifs (la TV du mode
// téléphones passe < 1 — l'écran CRT est petit, les sprites pleins étaient
// disproportionnés par rapport aux dresseurs et aux boîtes de PV).
export default function PkmnStage({ view, anim = {}, vfx = null, dialog = '', dialogSize = 17, trainers = null, spriteScale = 1 }) {
  if (!view) return null;
  const a = anim || {};
  const F = (sideKey) => view[sideKey].fighters[view[sideKey].active];
  const entering = (sideKey) => a.enter === sideKey || a.enter === 'both';
  const hpColor = (f) => (f.hp / f.maxHp > 0.5
    ? 'linear-gradient(180deg,#7de060,#3fae42)'
    : f.hp / f.maxHp > 0.2
      ? 'linear-gradient(180deg,#f2d060,#d8a53f)'
      : 'linear-gradient(180deg,#f28d60,#d84939)');

  const hpBox = (sideKey) => {
    const f = F(sideKey);
    const boosts = Object.entries(f.boosts || {}).filter(([, n]) => n !== 0);
    return (
      <div style={{
        width: 'min(30%, 300px)', minWidth: 230, borderRadius: 12, padding: '7px 13px 9px',
        background: 'linear-gradient(180deg, #fdf6dd, #f0e3bc)', border: '3px solid #5a4a28',
        boxShadow: '0 4px 10px rgba(0,0,0,0.35)',
      }}>
        <div style={{ fontWeight: 800, fontSize: 15.5, color: '#3a2c14', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {f.name}
          {f.status && <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', background: '#b58a1e', borderRadius: 4, padding: '1px 6px' }}>{AILMENT_TAG[f.status]}</span>}
          <span style={{ marginLeft: 'auto', color: '#7a6236', fontSize: 12.5, fontWeight: 600 }}>Nv. 50</span>
        </div>
        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: '#e8a020' }}>PV</span>
          <div style={{ flex: 1, height: 10, borderRadius: 6, background: '#4a3c20', padding: 2 }}>
            <div style={{ height: '100%', width: `${(f.hp / f.maxHp) * 100}%`, borderRadius: 4, background: hpColor(f), transition: 'width 650ms ease' }} />
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 3, alignItems: 'center' }}>
          <span style={{ display: 'flex', gap: 4 }}>
            {boosts.map(([stat, n]) => (
              <span key={stat} style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: n > 0 ? '#3fae42' : '#c9472f', borderRadius: 4, padding: '1px 5px' }}>
                {STAT_FR[stat]} {n > 0 ? `+${n}` : n}
              </span>
            ))}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#5a4a28' }}>{f.hp} / {f.maxHp}</span>
        </div>
      </div>
    );
  };

  const sprite = (sideKey) => {
    const f = F(sideKey);
    const left = sideKey === 'A';
    const fainting = a.faint === sideKey;
    const recalling = a.recall === sideKey;
    // Un K.O. hors animation (phase de remplacement, fin de combat) est CACHÉ :
    // on ne voit plus que le dresseur qui attend.
    if (f.ko && !fainting && !recalling) return null;
    let animation = 'none';
    const vars = {};
    if (fainting) animation = 'pkmnFaint 900ms ease-in forwards';
    else if (recalling) {
      animation = 'pkmnRecall 620ms ease-in forwards';
      vars['--rx'] = left ? '-13cqw' : '13cqw';
      vars['--ry'] = '5cqh';
    } else if (entering(sideKey)) {
      // La ball vole (650 ms), s'ouvre, puis le Pokémon se matérialise
      // (silhouette blanche → sprite). `both` = invisible pendant le délai.
      animation = 'pkmnMaterialize 750ms cubic-bezier(.2,1.3,.4,1) 640ms both';
    } else if (a.hit === sideKey) animation = 'pkmnHit 600ms linear';
    else if (a.lunge === sideKey) animation = `${left ? 'pkmnLungeL' : 'pkmnLungeR'} 700ms ease`;
    else if (a.cast === sideKey) animation = 'pkmnCast 500ms ease';
    return (
      <div
        key={`${sideKey}-${view[sideKey].active}`}
        style={{
          position: 'absolute',
          ...(left ? { left: '13%', bottom: '16%' } : { right: '13%', bottom: '46%' }),
          height: `${(left ? 30 : 25) * spriteScale}%`, zIndex: 3, pointerEvents: 'none',
        }}
      >
        <img
          src={f.sprite}
          alt={f.name}
          draggable={false}
          style={{
            height: '100%', imageRendering: 'pixelated',
            transform: left ? 'scaleX(-1)' : 'none', transformOrigin: '50% 100%',
            filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.35))',
            animation, ...vars, userSelect: 'none',
          }}
        />
      </div>
    );
  };

  // Le séisme secoue toute l'arène, calé sur l'impact (délai CSS).
  const shaking = vfx && vfx.archetype === 'quake';

  return (
    <>
      <style>{PKMN_STAGE_CSS}</style>
      <div
        key={shaking ? `shake-${vfx.seq}` : 'still'}
        style={{
          flex: 1, minHeight: 0, position: 'relative', borderRadius: 18, overflow: 'hidden',
          containerType: 'size', // → unités cqw/cqh pour les trajets de VFX
          background: 'linear-gradient(180deg, #8ecff2 0%, #b9e3f7 46%, #7cba6d 46%, #5f9e52 100%)',
          border: '3px solid rgba(243,201,105,0.5)',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.25)',
          animation: shaking ? 'pkmnShake 500ms linear 380ms' : 'none',
        }}
      >
        <div style={{ position: 'absolute', left: '8%', bottom: '11%', width: '26%', height: '9%', borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 40%, #cfe8b9, #9ec98a 70%, #86b573)' }} />
        <div style={{ position: 'absolute', right: '8%', bottom: '41%', width: '22%', height: '8%', borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 40%, #cfe8b9, #9ec98a 70%, #86b573)' }} />
        {trainers?.A && <Trainer side="A" trainer={trainers.A} gesture={entering('A') || a.recall === 'A'} />}
        {trainers?.B && <Trainer side="B" trainer={trainers.B} gesture={entering('B') || a.recall === 'B'} />}
        {sprite('A')}
        {sprite('B')}
        {entering('A') && <PokeBall key={`ball-A-${view.A.active}`} side="A" />}
        {entering('B') && <PokeBall key={`ball-B-${view.B.active}`} side="B" />}
        {a.recall === 'A' && <RecallFx side="A" />}
        {a.recall === 'B' && <RecallFx side="B" />}
        {vfx && <VfxLayer vfx={vfx} />}
        <div style={{ position: 'absolute', right: '3%', top: '6%', zIndex: 5 }}>{hpBox('B')}</div>
        <div style={{ position: 'absolute', left: '3%', bottom: '7%', zIndex: 5 }}>{hpBox('A')}</div>
      </div>
      <div style={{
        height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', padding: '0 20px',
        background: 'linear-gradient(180deg, #2b3a5e, #1c2740)', border: '3px solid #f0e3bc',
        color: '#fff', fontSize: dialogSize, fontWeight: 600, fontFamily: 'var(--font-ui)', textShadow: '0 2px 0 rgba(0,0,0,0.4)',
      }}>
        {dialog}
      </div>
    </>
  );
}
