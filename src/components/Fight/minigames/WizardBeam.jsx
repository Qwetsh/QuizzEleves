import { useEffect, useRef, useState } from 'react';
import { characterById } from '../../../data/characters';
import { soundThunder, soundSpell } from '../../../logic/sounds';
import hallBg from '../../../assets/spell-duel-hall.png';

// ════════════════════════════════════════════════════════════════════════════
//  WizardBeam — le VISUEL du « Duel de sorciers » (Priori Incantatem). Deux
//  sorciers face à face, baguettes tendues, deux rais de couleur d'équipe se
//  heurtant en un orbe lumineux au centre. L'orbe glisse vers le camp qui perd
//  le bras de fer magique ; quand il TOUCHE un sorcier, celui-ci est frappé.
//
//  ── ARCHITECTURE À DEUX COUCHES (refonte « puissance ») ──────────────────────
//  1. SOCLE CSS/SVG DÉTERMINISTE (aucun Math.random au rendu) : sorciers, orbe,
//     barre de domination, décor. Position/teintes pilotées par l'état publié du
//     store → identique sur les 4 surfaces (tactile/TV/téléphone/en ligne), et
//     seul rendu si le Canvas échoue (dégradation propre).
//  2. COUCHE CANVAS 2D ADDITIVE (WizardCanvas, PURE DÉCO) : éclairs déformés,
//     étincelles convergeant vers l'orbe, gerbe de poussée, explosion d'impact,
//     corona de l'orbe. Non déterministe (chaque appareil anime la sienne) — sans
//     incidence : rien d'anti-triche ici, tout se déduit des props (pos/push/hit).
//     Respecte prefers-reduced-motion (coupe l'animation, garde le socle).
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
const BEAM_Y = 0.46; // hauteur de l'axe des rais (fraction de la scène)
const orbLeft = (pos) => BEAM_LEFT + (BEAM_RIGHT - BEAM_LEFT) * (pos / 100);

// Durée du voyage de la décharge (bonne réponse) : la baguette → l'orbe. Volontaire-
// ment LENT pour qu'on VOIE le sort filer le long de l'arc puis exploser à l'arrivée.
// Partagé entre le Canvas (voyage + explosion) et le socle (secousse/tonnerre synchros).
const CAST_TRAVEL_MS = 700;

// Mélange deux couleurs hex #rrggbb à ratio t (0 → a, 1 → b).
function mix(a, b, t) {
  const pa = hex(a);
  const pb = hex(b);
  const c = (i) => Math.round(pa[i] + (pb[i] - pa[i]) * t);
  return `rgb(${c(0)}, ${c(1)}, ${c(2)})`;
}
function hex(c) {
  const s = (c || '#888888').trim();
  // Tolère `rgb()/rgba()` (mix() renvoie du rgb, et le socle DOM aussi) en plus
  // de l'hexadécimal — sinon parseInt(...,16) sur « rgb » donne NaN et casse tout
  // gradient Canvas qui le consomme (addColorStop lève, la boucle meurt).
  const m = s.match(/^rgba?\(([^)]+)\)/i);
  if (m) { const p = m[1].split(',').map((x) => parseInt(x, 10) || 0); return [p[0], p[1], p[2]]; }
  const h = s.replace('#', '');
  const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
// Assombrit (<1) ou éclaircit (>1) une couleur — volume du chapeau (ombre/lumière).
const shade = (c, f) => { const p = hex(c); const q = (v) => Math.max(0, Math.min(255, Math.round(v * f))); return `rgb(${q(p[0])},${q(p[1])},${q(p[2])})`; };
const colorSlug = (c) => (c || '').replace(/[^a-zA-Z0-9]/g, '');

const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// Socle CSS (déterministe) : flottement, pulsation d'orbe, secousse, K.O.,
// scintillement de la pointe de baguette. Les FX de particules vivent au Canvas.
export const WIZARD_BEAM_CSS = `
@keyframes wzBob { 0%, 100% { translate: 0 0; } 50% { translate: 0 -6px; } }
@keyframes wzOrbPulse { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.14); } }
@keyframes wzShake { 0%, 100% { transform: translate(0,0); } 20% { transform: translate(-6px, 2px); } 40% { transform: translate(5px, -3px); } 60% { transform: translate(-4px, 2px); } 80% { transform: translate(3px, -1px); } }
@keyframes wzKnockL { 0% { translate: 0 0; filter: none; } 30% { translate: -22px -6px; filter: brightness(2.4); } 100% { translate: -12px 6px; filter: brightness(1); rotate: -14deg; } }
@keyframes wzKnockR { 0% { translate: 0 0; filter: none; } 30% { translate: 22px -6px; filter: brightness(2.4); } 100% { translate: 12px 6px; filter: brightness(1); rotate: 14deg; } }
@keyframes wzWandTip { 0%, 100% { opacity: 0.75; } 50% { opacity: 1; } }
`;

const abs = (o) => ({ position: 'absolute', ...o });

// ════════════════════════════════════════════════════════════════════════════
//  COUCHE CANVAS — moteur de particules additif (non déterministe, décoratif)
// ════════════════════════════════════════════════════════════════════════════

// Un éclair déformé (déplacement de milieu) tracé en additif avec halo. Le cœur
// blanc surimprimé donne la sensation de plasma brûlant. Le scintillement
// (largeur + alpha aléatoires par frame) évite l'aspect « trait figé ».
function drawBolt(ctx, x1, y1, x2, y2, color, intensity) {
  const segs = 7;
  const jitter = 5 + intensity * 16;
  const pts = [[x1, y1]];
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const taper = 1 - Math.abs(0.5 - t) * 1.5; // amplitude max au milieu, nulle aux bouts
    const off = (Math.random() * 2 - 1) * jitter * taper;
    pts.push([x1 + dx * t + px * off, y1 + dy * t + py * off]);
  }
  pts.push([x2, y2]);
  const stroke = (w, style, blur) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = w; ctx.strokeStyle = style; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = color; ctx.shadowBlur = blur;
    ctx.stroke();
  };
  const flick = 0.7 + Math.random() * 0.3;
  stroke((3 + intensity * 5) * flick, rgba(color, 0.55), 16 + intensity * 14); // halo large
  stroke(1.6 + intensity * 2, rgba('#ffffff', 0.9 * flick), 6);                // cœur plasma
  ctx.shadowBlur = 0;
}

function WizardCanvas({ aColor, dColor, orbColor, pos, push, hit, compact }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const partsRef = useRef([]);            // étincelles / anneaux vivants
  const emitRef = useRef({ a: 0, d: 0, o: 0 }); // budgets d'émission ambiante
  const boostRef = useRef({ a: 0, d: 0 });      // sur-intensité d'éclair post-poussée
  const sizeRef = useRef({ w: 0, h: 0 });
  const stateRef = useRef({});
  stateRef.current = { aColor, dColor, orbColor, pos, compact };

  const density = compact ? 0.5 : 1; // moins de particules en démo/briefing
  const cap = compact ? 120 : 240;   // plafond dur (protège le mobile)

  const spawn = (p) => { const a = partsRef.current; a.push(p); if (a.length > cap) a.splice(0, a.length - cap); };

  // Géométrie scène → pixels (mêmes ancres que le socle DOM).
  const geo = () => {
    const { w, h } = sizeRef.current;
    const { pos: p } = stateRef.current;
    return {
      w, h, y: h * BEAM_Y,
      ax: w * (BEAM_LEFT / 100), dx: w * (BEAM_RIGHT / 100),
      ox: w * (orbLeft(p) / 100),
    };
  };

  // Bonne réponse : une DÉCHARGE part de la baguette du camp et file le long de
  // l'arc jusqu'à l'orbe (traînée de particules), où elle EXPLOSE en atteignant
  // l'autre couleur (gérée dans la boucle, kind 'proj'). Lente et lisible.
  useEffect(() => {
    if (!push) return;
    const { ax, dx, y } = geo();
    const left = push.side === 'attacker';
    const col = left ? stateRef.current.aColor : stateRef.current.dColor;
    // Le rai du lanceur reste sur-intensifié pendant tout le voyage de la décharge.
    boostRef.current[left ? 'a' : 'd'] = performance.now() + CAST_TRAVEL_MS + 140;
    spawn({ kind: 'proj', from: left ? ax : dx, x: left ? ax : dx, y, color: col, t: 0, dur: CAST_TRAVEL_MS / 1000, life: 999, max: 999 });
  }, [push?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // Explosion d'impact au camp frappé (K.O.).
  useEffect(() => {
    if (!hit) return;
    const { ax, dx, y } = geo();
    const left = hit.side === 'attacker';
    const x = left ? ax : dx;
    const col = left ? stateRef.current.aColor : stateRef.current.dColor;
    spawn({ kind: 'ring', x, y, r: 10, vr: 460, life: 0.6, max: 0.6, color: '#ffffff', w: 4 });
    spawn({ kind: 'ring', x, y, r: 6, vr: 300, life: 0.7, max: 0.7, color: col, w: 3 });
    const n = Math.round(40 * density);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * 340;
      spawn({ kind: 'spark', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 60, life: 0.5 + Math.random() * 0.6, max: 1.1, size: 2 + Math.random() * 3, color: Math.random() < 0.4 ? '#ffffff' : col, drag: 1.4, grav: 260 });
    }
  }, [hit?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined; // pas de contexte 2D → socle DOM seul (repli)

    const dpr = Math.min(2, (window.devicePixelRatio || 1));
    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      sizeRef.current = { w: r.width, h: r.height };
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    ro.observe(canvas);

    if (prefersReducedMotion()) return () => ro.disconnect(); // pas d'anim : socle seul

    // Émet une étincelle qui converge de la baguette vers l'orbe (énergie qui
    // « charge » l'orbe) — dispersion perpendiculaire légère.
    const emitBeam = (fromX, y, toX, color) => {
      const dir = Math.sign(toX - fromX) || 1;
      const t = Math.random() * 0.25; // départ près de la baguette
      const x = fromX + (toX - fromX) * t;
      const sp = 140 + Math.random() * 160;
      spawn({ kind: 'spark', x, y: y + (Math.random() * 2 - 1) * 3, vx: dir * sp, vy: (Math.random() * 2 - 1) * 30, life: 0.4 + Math.random() * 0.3, max: 0.7, size: 1.4 + Math.random() * 1.8, color, drag: 0.6 });
    };
    const emitOrb = (x, y, color) => {
      const ang = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 60;
      spawn({ kind: 'spark', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0.5 + Math.random() * 0.4, max: 0.9, size: 1.4 + Math.random() * 1.6, color, drag: 1.8 });
    };

    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { w, h, y, ax, dx, ox } = geo();
      const st = stateRef.current;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      // 1) Éclairs baguette → orbe (scintillement + sur-intensité post-poussée).
      const aInt = 0.35 + (now < boostRef.current.a ? 0.9 : 0);
      const dInt = 0.35 + (now < boostRef.current.d ? 0.9 : 0);
      drawBolt(ctx, ax, y, ox, y, st.aColor, aInt);
      drawBolt(ctx, dx, y, ox, y, st.dColor, dInt);

      // 2) Halo additif de l'orbe (pulsation douce, sinusoïde du temps).
      const pulse = 0.8 + Math.sin(now / 160) * 0.12;
      const rg = ctx.createRadialGradient(ox, y, 0, ox, y, (compact ? 26 : 44) * pulse);
      rg.addColorStop(0, rgba(st.orbColor, 0.55));
      rg.addColorStop(0.5, rgba(st.orbColor, 0.22));
      rg.addColorStop(1, rgba(st.orbColor, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(ox - 60, y - 60, 120, 120);

      // 3) Émission ambiante (budget = débit × dt, cadence indépendante du FPS).
      const em = emitRef.current;
      em.a += 46 * density * dt; while (em.a >= 1) { em.a -= 1; emitBeam(ax, y, ox, st.aColor); }
      em.d += 46 * density * dt; while (em.d >= 1) { em.d -= 1; emitBeam(dx, y, ox, st.dColor); }
      em.o += 30 * density * dt; while (em.o >= 1) { em.o -= 1; emitOrb(ox, y, st.orbColor); }

      // 4) Mise à jour + rendu des particules. `later` : particules ENGENDRÉES
      //    pendant l'itération (traînée/explosion de la décharge) — ajoutées APRÈS
      //    la boucle pour ne pas décaler les index (spawn peut rogner par l'avant).
      const parts = partsRef.current;
      const later = [];
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        const k = p.life / p.max;
        if (p.kind === 'proj') {
          // Voyage baguette → orbe (ease-out), en visant l'orbe COURANT.
          p.t += dt / p.dur;
          const prog = p.t >= 1 ? 1 : 1 - (1 - p.t) * (1 - p.t);
          const tx = ox;
          p.x = p.from + (tx - p.from) * prog;
          p.y = y;
          // Traînée d'énergie derrière la tête.
          for (let s = 0; s < 2; s++) {
            later.push({ kind: 'spark', x: p.x, y: p.y + (Math.random() * 2 - 1) * 3, vx: (Math.random() * 2 - 1) * 45, vy: (Math.random() * 2 - 1) * 45, life: 0.28 + Math.random() * 0.24, max: 0.52, size: 1.6 + Math.random() * 2, color: Math.random() < 0.3 ? '#ffffff' : p.color, drag: 1.5 });
          }
          // Tête lumineuse (halo coloré + cœur blanc-chaud).
          const hr = (compact ? 5 : 8) + Math.sin(now / 40) * 1;
          ctx.shadowColor = p.color; ctx.shadowBlur = 16;
          ctx.fillStyle = rgba(p.color, 0.95);
          ctx.beginPath(); ctx.arc(p.x, p.y, hr, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = rgba('#ffffff', 0.95);
          ctx.beginPath(); ctx.arc(p.x, p.y, hr * 0.5, 0, Math.PI * 2); ctx.fill();
          if (p.t >= 1) {
            // EXPLOSION : la décharge atteint l'autre couleur.
            later.push({ kind: 'ring', x: tx, y, r: 8, vr: 440, life: 0.6, max: 0.6, color: '#ffffff', w: 4 });
            later.push({ kind: 'ring', x: tx, y, r: 5, vr: 300, life: 0.75, max: 0.75, color: p.color, w: 3 });
            const n = Math.round(30 * density);
            for (let e = 0; e < n; e++) {
              const ang = (e / n) * Math.PI * 2 + Math.random() * 0.5;
              const sp = 150 + Math.random() * 280;
              later.push({ kind: 'spark', x: tx, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.75, life: 0.55 + Math.random() * 0.45, max: 1, size: 2 + Math.random() * 2.8, color: Math.random() < 0.35 ? '#ffffff' : p.color, drag: 1.9 });
            }
            parts.splice(i, 1);
          }
          continue;
        }
        if (p.kind === 'ring') {
          p.r += p.vr * dt;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.lineWidth = p.w * k;
          ctx.strokeStyle = rgba(p.color, 0.5 * k);
          ctx.stroke();
        } else {
          if (p.drag) { p.vx -= p.vx * p.drag * dt; p.vy -= p.vy * p.drag * dt; }
          if (p.grav) p.vy += p.grav * dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
          const r = p.size * (0.4 + k * 0.6);
          ctx.fillStyle = rgba(p.color, 0.9 * k);
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = rgba('#ffffff', 0.7 * k * k); // cœur blanc-chaud
          ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2); ctx.fill();
        }
      }
      for (let j = 0; j < later.length; j++) spawn(later[j]); // engendrées ce frame
      ctx.globalCompositeOperation = 'source-over';
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      style={abs({ inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 4, mixBlendMode: 'screen' })}
    />
  );
}

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
  // NB : plus de chapeau de sorcier sur les personnages — un chapeau vectoriel à
  // coordonnées fixes ne « tombe » jamais bien sur la tête de sprites pixel-art
  // tous différents (pas d'ancrage tête par personnage). La couleur d'équipe reste
  // portée par l'écharpe teintée + le rai. (Le repli silhouette garde un capuchon.)
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
        // Repli sans personnage : une silhouette encapuchonnée simple (capuchon
        // pointu conservé ici, car sans sprite la silhouette serait sans tête).
        <svg viewBox="0 0 68 92" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <polygon points="34,4 22,30 46,30" fill={shade(color, 0.85)} />
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

// ── Corps du rai (socle DOM) : barre lumineuse « cœur » du sort. Les étincelles
//    et éclairs vivent au Canvas ; ici on garde une base solide (repli + assise). ─
function Beam({ from, to, color, intense }) {
  const dir = to > from ? 1 : -1;
  const w = Math.abs(to - from);
  return (
    <div style={abs({
      left: `${Math.min(from, to)}%`, top: `${BEAM_Y * 100}%`, width: `${w}%`, height: intense ? 10 : 6,
      transform: 'translateY(-50%)', pointerEvents: 'none',
      borderRadius: 8,
      background: `linear-gradient(${dir > 0 ? '90deg' : '270deg'}, ${color}00, ${color}bb 30%, #fff 96%)`,
      boxShadow: `0 0 ${intense ? 18 : 10}px ${color}, 0 0 ${intense ? 34 : 20}px ${color}88`,
      opacity: intense ? 1 : 0.85,
      filter: 'blur(0.4px)',
    })} />
  );
}

export default function WizardBeam({ attacker, defender, pos = 50, push = null, hit = null, compact = false }) {
  const aColor = attacker?.color || '#c0392b';
  const dColor = defender?.color || '#2e86c1';
  const oLeft = orbLeft(pos);
  // Teinte de l'orbe vers le camp qui MÈNE (pos>50 → attaquant fonce à droite).
  const orbColor = mix(dColor, aColor, pos / 100);

  // Poussée : « fwoosh » du lancer immédiat, puis secousse d'écran + tonnerre
  // SYNCHRONISÉS avec l'impact de la décharge (arrivée à l'orbe, CAST_TRAVEL_MS).
  const [shakeSeq, setShakeSeq] = useState(0);
  const shakeTimer = useRef(0);
  useEffect(() => {
    if (!push) return undefined;
    try { if (!compact) soundSpell(); } catch { /* silencieux */ }
    clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => {
      setShakeSeq((s) => s + 1);
      try { if (!compact) soundThunder(); } catch { /* silencieux */ }
    }, CAST_TRAVEL_MS);
    return () => clearTimeout(shakeTimer.current);
  }, [push?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hit) return;
    try { if (!compact) soundSpell(); } catch { /* silencieux */ }
  }, [hit?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* Décor : la grande salle de Poudlard (image), DERRIÈRE les duellistes */}
      <div style={abs({ inset: 0, pointerEvents: 'none' })}>
        <img src={hallBg} alt="" style={abs({ inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 42%' })} />
        {/* vignette : assombrit les bords et fait ressortir le rai + les sorciers */}
        <div style={abs({ inset: 0, background: 'radial-gradient(ellipse at 50% 46%, transparent 28%, rgba(5,3,12,0.5) 100%)' })} />
        {/* halo central dramatique teinté par le meneur */}
        <div style={abs({
          left: '50%', top: '46%', width: '55%', height: '70%', transform: 'translate(-50%,-50%)',
          background: `radial-gradient(ellipse, ${orbColor}3a, transparent 70%)`,
        })} />
      </div>

      {/* Socle DOM des deux rais (cœur lumineux) — le Canvas ajoute éclairs/étincelles */}
      <Beam from={BEAM_LEFT} to={oLeft} color={aColor} intense={push?.side === 'attacker'} />
      <Beam from={BEAM_RIGHT} to={oLeft} color={dColor} intense={push?.side === 'defender'} />

      {/* Les sorciers */}
      <Wizard side="attacker" team={attacker} knocked={hit?.side === 'attacker'} compact={compact} />
      <Wizard side="defender" team={defender} knocked={hit?.side === 'defender'} compact={compact} />

      {/* Couche Canvas additive (éclairs, étincelles, gerbe, impact, corona) */}
      <WizardCanvas aColor={aColor} dColor={dColor} orbColor={orbColor} pos={pos} push={push} hit={hit} compact={compact} />

      {/* Cœur de l'orbe (socle DOM pulsant) — le halo/corona est peint au Canvas */}
      <div style={abs({ left: `${oLeft}%`, top: `${BEAM_Y * 100}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 4 })}>
        <div style={{
          width: compact ? 24 : 38, height: compact ? 24 : 38, borderRadius: '50%',
          background: `radial-gradient(circle at 40% 35%, #fff, ${orbColor} 55%, ${orbColor}88 80%)`,
          boxShadow: `0 0 18px 5px ${orbColor}, 0 0 36px 12px ${orbColor}66`,
          animation: 'wzOrbPulse 0.7s ease-in-out infinite',
        }} />
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
