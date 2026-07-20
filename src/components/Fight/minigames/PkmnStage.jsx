// Scène de combat Pokémon PARTAGÉE (arène + sprites + boîtes PV + dialogue +
// VFX par type) — consommée par PokemonBattleGame (tactile) et PkmnDuelStage
// (TV du mode téléphones). Purement présentationnelle : tout vient des props.
//
// `view`  = { A: { active, fighters: [{ name, sprite, hp, maxHp, status,
//            boosts, ko }] }, B: … } (vue d'affichage, pas le moteur).
// `anim`  = { lunge?: side, hit?: side, faint?: side }
// `vfx`   = { type, side, seq } — particules du TYPE de l'attaque sur la cible
//           (side = camp touché), seq force le re-déclenchement.

const STAT_FR = { atk: 'Atq', def: 'Déf', spc: 'Spé', spe: 'Vit' };
const AILMENT_TAG = { par: 'PAR', psn: 'PSN', slp: 'SOM' };

export const PKMN_STAGE_CSS = `
@keyframes pkmnPop { from { transform: scale(0) translateY(20px); } to { transform: scale(1) translateY(0); } }
@keyframes pkmnPopM { from { transform: scaleX(-1) scale(0) translateY(20px); } to { transform: scaleX(-1) scale(1) translateY(0); } }
@keyframes pkmnLungeL { 0% { translate: 0 0; } 40% { translate: 46px -14px; } 100% { translate: 0 0; } }
@keyframes pkmnLungeR { 0% { translate: 0 0; } 40% { translate: -46px 14px; } 100% { translate: 0 0; } }
@keyframes pkmnHit { 0%, 100% { filter: none; translate: 0 0; } 25% { filter: brightness(3); translate: -7px 0; } 50% { filter: brightness(0.6); translate: 7px 0; } 75% { filter: brightness(2); translate: -4px 0; } }
@keyframes pkmnFaint { to { transform: translateY(40px); opacity: 0; } }
@keyframes pkmnVfxPart {
  0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
  12% { opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(1.25) rotate(var(--rot)); opacity: 0; }
}
@keyframes pkmnVfxGlow { 0% { opacity: 0; transform: scale(0.3); } 35% { opacity: 0.85; } 100% { opacity: 0; transform: scale(1.6); } }
@keyframes pkmnShake { 0%, 100% { transform: translate(0, 0); } 20% { transform: translate(-9px, 3px); } 40% { transform: translate(8px, -3px); } 60% { transform: translate(-6px, 2px); } 80% { transform: translate(5px, -2px); } }
`;

// Particule + couleur de halo par type d'attaque (15 types Gén. 1).
const VFX_OF = {
  fire: ['🔥', '#ff7a2f'], water: ['💧', '#4aa8ff'], grass: ['🍃', '#57c84d'],
  bug: ['🍃', '#a8b820'], electric: ['⚡', '#ffd93b'], ice: ['❄️', '#9ce4f2'],
  fighting: ['💥', '#e06030'], normal: ['💫', '#e8e0c8'], ground: ['🪨', '#c9a25a'],
  rock: ['🪨', '#b8a038'], poison: ['☠️', '#a86bc9'], psychic: ['🌀', '#f85888'],
  ghost: ['👻', '#8a6fc0'], dragon: ['🌀', '#7a5cf0'], flying: ['🌪️', '#a890f0'],
};
// Types qui secouent l'arène entière à l'impact.
const SHAKE_TYPES = new Set(['ground', 'rock', 'fighting', 'normal']);

// 12 particules à trajectoires pseudo-aléatoires déterministes (par index+seq).
function VfxBurst({ vfx }) {
  const [emoji, glow] = VFX_OF[vfx.type] || VFX_OF.normal;
  const parts = Array.from({ length: 12 }, (_, i) => {
    const a = ((i * 137 + vfx.seq * 61) % 360) * (Math.PI / 180);
    const d = 46 + ((i * 53 + vfx.seq * 29) % 60);
    return {
      dx: `${Math.cos(a) * d}px`, dy: `${Math.sin(a) * d - 22}px`,
      rot: `${((i * 97) % 240) - 120}deg`, delay: `${(i % 5) * 45}ms`,
      size: 15 + ((i * 31) % 14),
    };
  });
  const pos = vfx.side === 'A'
    ? { left: '17%', bottom: '26%' }
    : { right: '17%', bottom: '54%' };
  return (
    <div key={vfx.seq} style={{ position: 'absolute', ...pos, width: 0, height: 0, zIndex: 5, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', left: -55, top: -55, width: 110, height: 110, borderRadius: '50%',
        background: `radial-gradient(circle, ${glow}cc 0%, ${glow}55 45%, transparent 70%)`,
        animation: 'pkmnVfxGlow 620ms ease-out forwards',
      }} />
      {parts.map((p, i) => (
        <span key={i} style={{
          position: 'absolute', left: -10, top: -10, fontSize: p.size, lineHeight: 1,
          '--dx': p.dx, '--dy': p.dy, '--rot': p.rot,
          animation: `pkmnVfxPart 640ms ease-out ${p.delay} forwards`,
          opacity: 0, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))',
        }}>
          {emoji}
        </span>
      ))}
    </div>
  );
}

export default function PkmnStage({ view, anim = {}, vfx = null, dialog = '', dialogSize = 17 }) {
  if (!view) return null;
  const F = (sideKey) => view[sideKey].fighters[view[sideKey].active];
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
    const animation = anim.faint === sideKey
      ? 'pkmnFaint 900ms ease-in forwards'
      : anim.hit === sideKey
        ? 'pkmnHit 600ms linear'
        : anim.lunge === sideKey
          ? `${left ? 'pkmnLungeL' : 'pkmnLungeR'} 700ms ease`
          : `${left ? 'pkmnPopM' : 'pkmnPop'} 400ms cubic-bezier(.2,1.4,.4,1)`;
    return (
      <img
        key={`${sideKey}-${view[sideKey].active}`}
        src={f.sprite}
        alt={f.name}
        draggable={false}
        style={{
          position: 'absolute',
          ...(left ? { left: '13%', bottom: '16%' } : { right: '13%', bottom: '46%' }),
          height: left ? '30%' : '25%',
          imageRendering: 'pixelated',
          transform: left ? 'scaleX(-1)' : 'none',
          filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.35))',
          animation,
          userSelect: 'none', pointerEvents: 'none',
        }}
      />
    );
  };

  const shaking = vfx && SHAKE_TYPES.has(vfx.type);

  return (
    <>
      <style>{PKMN_STAGE_CSS}</style>
      <div
        key={shaking ? `shake-${vfx.seq}` : 'still'}
        style={{
          flex: 1, minHeight: 0, position: 'relative', borderRadius: 18, overflow: 'hidden',
          background: 'linear-gradient(180deg, #8ecff2 0%, #b9e3f7 46%, #7cba6d 46%, #5f9e52 100%)',
          border: '3px solid rgba(243,201,105,0.5)',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.25)',
          animation: shaking ? 'pkmnShake 450ms linear' : 'none',
        }}
      >
        <div style={{ position: 'absolute', left: '8%', bottom: '11%', width: '26%', height: '9%', borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 40%, #cfe8b9, #9ec98a 70%, #86b573)' }} />
        <div style={{ position: 'absolute', right: '8%', bottom: '41%', width: '22%', height: '8%', borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 40%, #cfe8b9, #9ec98a 70%, #86b573)' }} />
        {sprite('A')}
        {sprite('B')}
        {vfx && <VfxBurst vfx={vfx} />}
        <div style={{ position: 'absolute', right: '3%', top: '6%' }}>{hpBox('B')}</div>
        <div style={{ position: 'absolute', left: '3%', bottom: '7%' }}>{hpBox('A')}</div>
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
