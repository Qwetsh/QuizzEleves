import { useEffect, useState } from 'react';
import { characterById } from '../../../data/characters';
import { soundThunder, soundSpell } from '../../../logic/sounds';

// ════════════════════════════════════════════════════════════════════════════
//  WizardBeam — le VISUEL réutilisable du « Duel de sorciers » (Priori
//  Incantatem). Deux sorciers face à face, baguettes tendues, deux rais de
//  couleur d'équipe se heurtant en un orbe lumineux au centre. L'orbe glisse
//  vers le camp qui perd le bras de fer magique ; quand il TOUCHE un sorcier,
//  celui-ci est frappé.
//
//  100 % CSS/SVG DÉTERMINISTE (aucun Math.random au rendu — les particules sont
//  dérivées de leur index, comme dans PkmnStage) → réutilisable tel quel sur
//  téléphone/en ligne à partir de l'état publié par le store.
//
//  Props :
//    attacker, defender : équipes { name, color, character }
//    pos                : 0..100, position de l'orbe (50 = centre)
//    push  : { side, seq } | null : dernière poussée (relance l'anim par seq)
//    hit   : { side, seq } | null : le camp `side` vient d'être FRAPPÉ (K.O.)
//    compact?           : version réduite (démo/briefing)
// ════════════════════════════════════════════════════════════════════════════

// Position de l'orbe sur l'axe des baguettes, en % de la largeur de la scène.
// Les baguettes pointent depuis ~14% (gauche) et ~86% (droite) ; l'orbe
// interpole entre ces deux ancres selon pos (0 = tout à gauche → 100 = droite).
const BEAM_LEFT = 14;
const BEAM_RIGHT = 86;
const orbLeft = (pos) => BEAM_LEFT + (BEAM_RIGHT - BEAM_LEFT) * (pos / 100);

// Mélange deux couleurs hex #rrggbb à ratio t (0 → a, 1 → b).
function mix(a, b, t) {
  const pa = hex(a);
  const pb = hex(b);
  const c = (i) => Math.round(pa[i] + (pb[i] - pa[i]) * t);
  return `rgb(${c(0)}, ${c(1)}, ${c(2)})`;
}
function hex(c) {
  const s = (c || '#888888').replace('#', '');
  const n = s.length === 3 ? s.split('').map((x) => x + x).join('') : s;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

const colorSlug = (c) => (c || '').replace(/[^a-zA-Z0-9]/g, '');

export const WIZARD_BEAM_CSS = `
@keyframes wzBob { 0%, 100% { translate: 0 0; } 50% { translate: 0 -6px; } }
/* flux d'énergie qui court le long du rai (déterministe, dérivé de l'index) */
@keyframes wzFlow { 0% { transform: translateX(0) scale(0.6); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateX(var(--flow)) scale(1.1); opacity: 0; } }
@keyframes wzOrbPulse { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.14); } }
@keyframes wzSpark { 0% { transform: rotate(var(--a)) translateX(0) scale(1); opacity: 1; } 100% { transform: rotate(var(--a)) translateX(var(--r)) scale(0.2); opacity: 0; } }
/* poussée : l'orbe accélère et le camp pousseur s'illumine — via secousse */
@keyframes wzShake { 0%, 100% { transform: translate(0,0); } 20% { transform: translate(-6px, 2px); } 40% { transform: translate(5px, -3px); } 60% { transform: translate(-4px, 2px); } 80% { transform: translate(3px, -1px); } }
@keyframes wzPushBurst { 0% { transform: translate(-50%,-50%) scale(0.3); opacity: 0.95; } 100% { transform: translate(-50%,-50%) scale(2.6); opacity: 0; } }
/* impact : explosion à l'extrémité + knockback du sorcier touché */
@keyframes wzHitFlash { 0% { transform: translate(-50%,-50%) scale(0.2); opacity: 1; } 60% { opacity: 0.9; } 100% { transform: translate(-50%,-50%) scale(3.4); opacity: 0; } }
@keyframes wzKnockL { 0% { translate: 0 0; filter: none; } 30% { translate: -22px -6px; filter: brightness(2.4); } 100% { translate: -12px 6px; filter: brightness(1); rotate: -14deg; } }
@keyframes wzKnockR { 0% { translate: 0 0; filter: none; } 30% { translate: 22px -6px; filter: brightness(2.4); } 100% { translate: 12px 6px; filter: brightness(1); rotate: 14deg; } }
@keyframes wzWandTip { 0%, 100% { opacity: 0.75; } 50% { opacity: 1; } }
`;

const abs = (o) => ({ position: 'absolute', ...o });

// ── Un sorcier (personnage pixel-art + écharpe teintée + baguette tendue) ─────
function Wizard({ side, team, knocked, compact }) {
  const char = characterById(team?.character);
  const left = side === 'attacker';
  const color = team?.color || '#8a7dd6';
  const fid = `wzbeam-scarf-${side}-${colorSlug(color)}`;
  const knockAnim = knocked
    ? `${left ? 'wzKnockL' : 'wzKnockR'} 700ms ease-out forwards`
    : `wzBob 3.4s ease-in-out infinite ${left ? '0s' : '-1.7s'}`;
  const h = compact ? '46%' : '58%';
  return (
    <div
      style={abs({
        ...(left ? { left: '1.5%' } : { right: '1.5%' }),
        bottom: '6%', height: h, aspectRatio: '68 / 92', zIndex: 3,
        transformOrigin: '50% 100%',
        animation: knockAnim,
        filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.5))',
      })}
    >
      {char ? (
        <svg viewBox="0 0 68 92" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <filter id={fid} colorInterpolationFilters="sRGB">
              <feFlood floodColor={color} result="flood" />
              <feComposite in="flood" in2="SourceGraphic" operator="in" result="tint" />
              <feBlend in="tint" in2="SourceGraphic" mode="multiply" />
            </filter>
          </defs>
          {/* chapeau pointu de sorcier, teinté équipe */}
          <g>
            <polygon points="34,2 22,26 46,26" fill={color} opacity="0.95" />
            <ellipse cx="34" cy="26" rx="18" ry="4.5" fill={color} opacity="0.95" />
            <circle cx="34" cy="9" r="2.4" fill="#fff" opacity="0.85" />
          </g>
          {/* sprites dessinés tournés vers la gauche → camp gauche miroité pour
              faire face à droite (même technique que les pions / Trainer). */}
          <g transform={left ? 'translate(68 0) scale(-1 1)' : undefined}>
            <image href={char.body} x="0" y="16" width="68" height="76" preserveAspectRatio="xMidYMax meet" />
            {char.scarf && (
              <image href={char.scarf} x="0" y="16" width="68" height="76" preserveAspectRatio="xMidYMax meet" filter={`url(#${fid})`} />
            )}
          </g>
        </svg>
      ) : (
        // Repli sans personnage : une silhouette encapuchonnée simple.
        <svg viewBox="0 0 68 92" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <polygon points="34,2 22,26 46,26" fill={color} />
          <path d="M20 34 Q34 26 48 34 L52 90 L16 90 Z" fill={color} opacity="0.9" />
        </svg>
      )}
      {/* Baguette tendue vers le centre (petit trait lumineux + pointe scintillante) */}
      <div style={abs({
        top: compact ? '38%' : '42%',
        ...(left ? { right: '-14%' } : { left: '-14%' }),
        width: '30%', height: 4, borderRadius: 3,
        background: `linear-gradient(${left ? '90deg' : '270deg'}, #6a5636, #d8c39a)`,
        transform: `rotate(${left ? -8 : 8}deg)`,
        transformOrigin: left ? 'left center' : 'right center',
        boxShadow: `0 0 6px ${color}`,
      })}>
        <div style={abs({
          [left ? 'right' : 'left']: -4, top: -3, width: 10, height: 10, borderRadius: '50%',
          background: `radial-gradient(circle, #fff, ${color})`,
          boxShadow: `0 0 10px 2px ${color}`,
          animation: 'wzWandTip 0.9s ease-in-out infinite',
        })} />
      </div>
    </div>
  );
}

// ── Un rai (baguette → centre) avec flux de particules déterministe ──────────
function Beam({ from, to, color, intense }) {
  const dir = to > from ? 1 : -1;
  const w = Math.abs(to - from);
  const N = 7;
  return (
    <div style={abs({
      left: `${Math.min(from, to)}%`, top: '46%', width: `${w}%`, height: intense ? 12 : 8,
      transform: 'translateY(-50%)', pointerEvents: 'none',
    })}>
      {/* corps du rai + lueur */}
      <div style={abs({
        inset: 0, borderRadius: 8,
        background: `linear-gradient(${dir > 0 ? '90deg' : '270deg'}, ${color}00, ${color}cc 30%, #fff 96%)`,
        boxShadow: `0 0 ${intense ? 20 : 12}px ${color}, 0 0 ${intense ? 40 : 22}px ${color}88`,
        opacity: intense ? 1 : 0.9,
        filter: 'blur(0.4px)',
      })} />
      {/* flux d'énergie : N particules dérivées de l'index (pas de random) */}
      {Array.from({ length: N }, (_, i) => {
        const startPct = (i / N) * 100;
        const flow = `${dir * (w * 0.7)}cqw`;
        return (
          <div
            key={i}
            style={abs({
              left: `${startPct}%`, top: '50%', width: 6, height: 6, borderRadius: '50%',
              background: `radial-gradient(circle, #fff, ${color})`,
              boxShadow: `0 0 6px ${color}`,
              transform: 'translateY(-50%)',
              '--flow': flow,
              animation: `wzFlow ${1.1 + (i % 3) * 0.18}s linear infinite`,
              animationDelay: `${(i / N) * 1.1}s`,
            })}
          />
        );
      })}
    </div>
  );
}

export default function WizardBeam({ attacker, defender, pos = 50, push = null, hit = null, compact = false }) {
  const aColor = attacker?.color || '#c0392b';
  const dColor = defender?.color || '#2e86c1';
  const oLeft = orbLeft(pos);
  // Teinte de l'orbe vers le camp qui MÈNE (pos>50 → attaquant fonce à droite).
  const orbColor = mix(dColor, aColor, pos / 100);

  // Secousse d'écran brève à chaque poussée (relancée par push.seq).
  const [shakeSeq, setShakeSeq] = useState(0);
  useEffect(() => {
    if (!push) return;
    setShakeSeq((s) => s + 1);
    try { if (!compact) soundThunder(); } catch { /* silencieux */ }
  }, [push?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hit) return;
    try { if (!compact) soundSpell(); } catch { /* silencieux */ }
  }, [hit?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const pushColor = push ? (push.side === 'attacker' ? aColor : dColor) : orbColor;

  return (
    <div
      // key sur shakeSeq : remonte le nœud → l'anim de secousse repart de zéro
      // (une transition dont les 2 valeurs tombent dans le même recalc ne part
      //  pas — d'où le remontage explicite, piège projet).
      key={`shake-${shakeSeq}`}
      style={{
        position: 'relative', width: '100%', height: '100%', minHeight: compact ? 120 : 200,
        borderRadius: 16, overflow: 'hidden', containerType: 'inline-size',
        background: 'radial-gradient(ellipse at 50% 30%, #1a1230 0%, #0d0818 60%, #050308 100%)',
        border: '2px solid rgba(120,90,180,0.35)',
        boxShadow: 'inset 0 0 60px rgba(0,0,0,0.6)',
        animation: shakeSeq ? 'wzShake 260ms ease-out' : undefined,
      }}
    >
      <style>{WIZARD_BEAM_CSS}</style>

      {/* Décor : grande salle / cachot — colonnes + vitraux en silhouettes */}
      <div style={abs({ inset: 0, pointerEvents: 'none' })}>
        {/* halo central dramatique */}
        <div style={abs({
          left: '50%', top: '46%', width: '55%', height: '70%', transform: 'translate(-50%,-50%)',
          background: `radial-gradient(ellipse, ${orbColor}33, transparent 70%)`,
        })} />
        {/* vitraux (arcs colorés en fond) */}
        {[22, 50, 78].map((x, i) => (
          <div key={i} style={abs({
            left: `${x}%`, top: '4%', width: '13%', height: '46%', transform: 'translateX(-50%)',
            borderRadius: '50% 50% 8% 8% / 60% 60% 8% 8%',
            background: `linear-gradient(180deg, ${['#3a2d6a', '#2d4a6a', '#5a2d4a'][i]}66, transparent)`,
            border: '1px solid rgba(180,160,220,0.12)',
          })} />
        ))}
        {/* colonnes latérales en silhouette */}
        {['8%', '92%'].map((x, i) => (
          <div key={i} style={abs({
            left: x, bottom: 0, width: '7%', height: '82%', transform: 'translateX(-50%)',
            background: 'linear-gradient(180deg, rgba(20,14,34,0.2), rgba(30,22,50,0.85))',
            borderRadius: '6px 6px 0 0',
          })} />
        ))}
        {/* sol en dalles sombres */}
        <div style={abs({ left: 0, right: 0, bottom: 0, height: '18%', background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.55))' })} />
      </div>

      {/* Les deux rais convergents vers l'orbe */}
      <Beam from={BEAM_LEFT} to={oLeft} color={aColor} intense={push?.side === 'attacker'} />
      <Beam from={BEAM_RIGHT} to={oLeft} color={dColor} intense={push?.side === 'defender'} />

      {/* Les sorciers */}
      <Wizard side="attacker" team={attacker} knocked={hit?.side === 'attacker'} compact={compact} />
      <Wizard side="defender" team={defender} knocked={hit?.side === 'defender'} compact={compact} />

      {/* L'orbe à la jonction des rais */}
      <div style={abs({ left: `${oLeft}%`, top: '46%', transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 4 })}>
        {/* gerbe d'étincelles de poussée (relancée par push.seq) */}
        {push && (
          <div key={`burst-${push.seq}`}>
            <div style={abs({
              left: '50%', top: '50%', width: 60, height: 60, borderRadius: '50%',
              background: `radial-gradient(circle, ${pushColor}, transparent 65%)`,
              animation: 'wzPushBurst 420ms ease-out forwards',
            })} />
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} style={abs({
                left: '50%', top: '50%', width: 5, height: 5, borderRadius: '50%',
                background: pushColor, boxShadow: `0 0 6px ${pushColor}`,
                '--a': `${i * 36}deg`, '--r': `${26 + (i % 3) * 8}px`,
                animation: 'wzSpark 460ms ease-out forwards',
              })} />
            ))}
          </div>
        )}
        {/* l'orbe pulsant */}
        <div style={{
          width: compact ? 26 : 42, height: compact ? 26 : 42, borderRadius: '50%',
          background: `radial-gradient(circle at 40% 35%, #fff, ${orbColor} 55%, ${orbColor}88 80%)`,
          boxShadow: `0 0 22px 6px ${orbColor}, 0 0 44px 14px ${orbColor}66`,
          animation: 'wzOrbPulse 0.7s ease-in-out infinite',
        }} />
        {/* explosion d'impact (relancée par hit.seq) */}
        {hit && (
          <div key={`hit-${hit.seq}`} style={abs({
            left: '50%', top: '50%', width: 80, height: 80, borderRadius: '50%',
            background: `radial-gradient(circle, #fff, ${hit.side === 'attacker' ? aColor : dColor} 55%, transparent 75%)`,
            animation: 'wzHitFlash 620ms ease-out forwards',
          })} />
        )}
      </div>

      {/* Barre de domination sous la scène (pos en %) */}
      {!compact && (
        <div style={abs({ left: '8%', right: '8%', bottom: '3%', height: 6, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.12)', zIndex: 5 })}>
          <div style={{
            height: '100%', width: `${pos}%`,
            background: `linear-gradient(90deg, ${aColor}, ${orbColor})`,
            transition: 'width 420ms cubic-bezier(0.22,1,0.36,1)',
          }} />
        </div>
      )}
    </div>
  );
}
