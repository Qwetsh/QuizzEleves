import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { SUBJECTS } from '../../data/subjects';
import { NODE_RADIUS, TILE_SCALE, islandCircles as buildIslandCircles, bezierPoint } from '../../logic/boardGeometry';
import { SPACE_ASSET_DIMS, SOCLE_W, ILOT_W, SOCLE_TOP_DY, ILOT_TOP_DY, SPECIAL_CASE_ASSET, CASE_W_CONTINENT, CASE_W_SPACE, CASE_TOP_DY, PIEGE_W } from '../../data/maps/espace.js';
import { getPendingMalus } from '../../logic/teamStatus';
import { characterById } from '../../data/characters';
import { useT } from '../../i18n';

// Assets du plateau (refonte pierre & jungle) — voir scripts/name-assets.mjs
const BOARD_ASSET_URLS = import.meta.glob('../../assets/board/*.{png,jpg}', { eager: true, query: '?url', import: 'default' });
const BOARD_ASSETS = Object.fromEntries(
  Object.entries(BOARD_ASSET_URLS).map(([p, url]) => [p.split('/').pop().replace(/\.(png|jpg)$/, ''), url])
);
const bimg = (name) => BOARD_ASSETS[name];

// Assets de l'univers « espace » (maps v2) — socles/îlots en PNG
// (scripts/space-assets.mjs), continents thématiques en WebP
// (scripts/space-continents.mjs).
const SPACE_ASSET_URLS = import.meta.glob('../../assets/space/*.{png,webp}', { eager: true, query: '?url', import: 'default' });
const SPACE_ASSETS = Object.fromEntries(
  Object.entries(SPACE_ASSET_URLS).map(([p, url]) => [p.split('/').pop().replace(/\.(png|webp)$/, ''), url])
);
const simg = (name) => SPACE_ASSETS[name];

// Taille (en unités viewBox) d'une tuile de la texture d'herbe
const GRASS_TILE = 460;

// Rayons des cases et géométrie de l'île : voir src/logic/boardGeometry.js
// (source partagée avec decorGenerator pour le placement des props)

// Pierres de gué le long de la courbe de Bezier d'un chemin
// (les segments d'assets ne peuvent pas suivre la geometrie generee)
function SteppingStones({ x0, y0, x1, y1 }) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(2, Math.round(dist / 58));
  const stones = [];
  for (let i = 1; i <= n; i++) {
    const t = 0.16 + (0.68 * i) / (n + 1);
    const { x: px, y: py } = bezierPoint(x0, y0, x1, y1, t);
    const s = 1 + ((i % 3) - 1) * 0.18;
    stones.push(
      <g key={i} transform={`translate(${px} ${py})`}>
        <ellipse cx={1} cy={3} rx={12 * s} ry={8.5 * s} fill="rgba(60, 42, 18, 0.22)" />
        <ellipse rx={12 * s} ry={8.5 * s} fill="#ddd1a9" stroke="#a3946f" strokeWidth={1.5} />
        <ellipse cx={-2.5 * s} cy={-2 * s} rx={6 * s} ry={3.4 * s} fill="rgba(255, 250, 230, 0.4)" />
      </g>
    );
  }
  return stones;
}

// Step-by-step pawn animation
const STEP_DURATION = 220; // ms per step

// Pion « personnage » : boîte d'affichage (unités viewBox), ancrée par les pieds
// (préserve le ratio, aligné en bas → le perso se tient sur le socle).
const SPRITE_H = 76;
const SPRITE_W = 68;
const FEET_DY = 20;          // les pieds sont FEET_DY sous le centre de la case
const TORSO_Y = -SPRITE_H * 0.4; // centre approx. du torse (halos/anneaux)

// Slug sûr pour un id de filtre à partir d'une couleur (#d63a3a -> d63a3a)
const colorSlug = (c) => (c || '').replace(/[^a-zA-Z0-9]/g, '');

// Filtres partagés des pions : lueur du tour actif + teinte d'écharpe par couleur
// d'équipe (multiply de la couleur pleine par le gris ombré de l'écharpe).
function PawnDefs({ colors }) {
  return (
    <defs>
      <filter id="pawn-glow" x="-70%" y="-70%" width="240%" height="240%">
        <feGaussianBlur stdDeviation="7" />
      </filter>
      {colors.map((c) => (
        <filter key={c} id={`scarf-tint-${colorSlug(c)}`} colorInterpolationFilters="sRGB">
          <feFlood floodColor={c} result="flood" />
          <feComposite in="flood" in2="SourceGraphic" operator="in" result="tint" />
          <feBlend in="tint" in2="SourceGraphic" mode="multiply" />
        </filter>
      ))}
    </defs>
  );
}

const Pawn = React.memo(function Pawn({ team, idx, px, py, isActive, move, onMoveComplete, float }) {
  const [animPos, setAnimPos] = useState({ x: px, y: py });
  const animating = useRef(false);

  // Animate through waypoints when a move targets this pawn
  useEffect(() => {
    if (!move || move.waypoints.length < 2) {
      setAnimPos({ x: px, y: py });
      return;
    }

    animating.current = true;
    const waypoints = move.waypoints;
    let step = 0;
    setAnimPos({ x: waypoints[0].x, y: waypoints[0].y });

    const interval = setInterval(() => {
      step++;
      if (step >= waypoints.length) {
        clearInterval(interval);
        animating.current = false;
        if (onMoveComplete) onMoveComplete(idx);
        return;
      }
      setAnimPos({ x: waypoints[step].x, y: waypoints[step].y });
    }, STEP_DURATION);

    return () => clearInterval(interval);
  }, [move, idx, onMoveComplete]);

  // When not animating, sync to final position
  useEffect(() => {
    if (!animating.current) {
      setAnimPos({ x: px, y: py });
    }
  }, [px, py]);

  const isBack = move?.type === 'back';
  // Malus en attente (ex. question imposée) : UNE seule aune, quel que soit le
  // nombre de malus (pas de cumul d'animation).
  const hasMalus = getPendingMalus(team).length > 0;
  const char = characterById(team.character);
  const spriteX = -SPRITE_W / 2;
  const spriteY = FEET_DY - SPRITE_H;

  return (
    // Enveloppe extérieure : lévitation (le perso bobbe AVEC son continent/îlot,
    // via la même animation CSS que la case). La position (x,y) est portée par le
    // <motion.g> intérieur — les deux transforms se composent.
    <g style={floatStyle(float)}>
      <motion.g
        data-pawn-idx={idx}
        animate={{ x: animPos.x, y: animPos.y }}
        transition={{ type: 'spring', damping: 22, stiffness: 180, mass: 0.6 }}
      >
        {/* Ombre portée au sol */}
        <ellipse cx={0} cy={FEET_DY - 3} rx={19} ry={5.5} fill="rgba(0,0,0,0.28)" style={{ pointerEvents: 'none' }} />

        {/* Halo lumineux du tour actif : lueur diffuse derrière + anneau au sol */}
        {isActive && !isBack && (
          <>
            <motion.circle
              cx={0} cy={TORSO_Y} r={27}
              fill={team.color} filter="url(#pawn-glow)"
              initial={{ opacity: 0.22 }}
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ pointerEvents: 'none' }}
            />
            <motion.ellipse
              cx={0} cy={FEET_DY - 3} rx={21} ry={7}
              fill="none" stroke={team.color} strokeWidth={3}
              initial={{ opacity: 0.4, scale: 0.85 }}
              animate={{ opacity: [0.4, 0.9, 0.4], scale: [0.85, 1.1, 0.85] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ pointerEvents: 'none' }}
            />
          </>
        )}

        {hasMalus && (
          <motion.circle
            cx={0} cy={TORSO_Y} r={32}
            fill="none" stroke="#b5341f" strokeWidth={3} strokeDasharray="6 7"
            initial={{ opacity: 0.45 }}
            animate={{ opacity: [0.45, 0.95, 0.45], rotate: 360 }}
            transition={{ opacity: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 9, repeat: Infinity, ease: 'linear' } }}
            style={{ filter: 'drop-shadow(0 0 6px rgba(181,52,31,0.7))', pointerEvents: 'none' }}
          />
        )}
        {isBack && (
          <motion.ellipse
            cx={0} cy={FEET_DY - 3} rx={21} ry={7}
            fill="none" stroke="#c9472f" strokeWidth={3.5}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.8, 0], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {char && char.body ? (
          <motion.g whileHover={{ scale: 1.08 }} style={{ transformOrigin: `0px ${FEET_DY}px` }}>
            {/* Les sprites sont dessinés tournés vers la gauche ; on les miroite
                pour qu'ils regardent vers l'arrivée (le plateau progresse → droite). */}
            <g transform="scale(-1 1)">
              <image
                href={char.body}
                x={spriteX} y={spriteY} width={SPRITE_W} height={SPRITE_H}
                preserveAspectRatio="xMidYMax meet"
                style={{ pointerEvents: 'none', filter: isActive ? 'drop-shadow(0 0 3px rgba(255,255,255,0.5))' : undefined }}
              />
              {char.scarf && (
                <image
                  href={char.scarf}
                  x={spriteX} y={spriteY} width={SPRITE_W} height={SPRITE_H}
                  preserveAspectRatio="xMidYMax meet"
                  filter={`url(#scarf-tint-${colorSlug(team.color)})`}
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </g>
          </motion.g>
        ) : (
          // Repli (personnage manquant) : ancien pion cercle + emoji
          <>
            <motion.circle
              cx={0} cy={0} r={24}
              fill="white" stroke={isBack ? '#c9472f' : team.color}
              strokeWidth={isActive ? 5 : 3.5}
              filter={isActive ? 'url(#glow-active)' : undefined}
              whileHover={{ scale: 1.15 }}
            />
            <text x={0} y={1} textAnchor="middle" dominantBaseline="central" fontSize={28} style={{ pointerEvents: 'none' }}>
              {team.emoji}
            </text>
          </>
        )}
      </motion.g>
    </g>
  );
});

function ChoiceHighlight({ cx, cy, r }) {
  return (
    <motion.circle
      cx={cx} cy={cy} r={r + 10}
      fill="none" stroke="#facc15" strokeWidth={5}
      initial={{ opacity: 0.4, scale: 0.9 }}
      animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.05, 0.9] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// --- Couches mémoïsées du plateau ---
// Le terrain (defs, île, herbe, chemins) et la couche décor+tuiles ne
// dépendent que du plateau : sans React.memo, chaque pas d'animation de pion
// (changement de teams/movePath) reconstruisait ~2500 éléments SVG statiques.

const Terrain = React.memo(function Terrain({ board, islandCircles, viewBox }) {
  return (
    <>
      <defs>
        <filter id="glow-active">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Fusion organique des cercles de l'île (blur + seuil sur l'alpha) */}
        <filter id="gooey" x="-25%" y="-40%" width="150%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="28" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
          />
        </filter>
        {/* Textures peintes (herbe, sable) en tuilage miroir — aucune couture */}
        {['herbe', 'sable'].map((tex) => (
          <pattern key={tex} id={`tex-${tex}`} patternUnits="userSpaceOnUse" width={GRASS_TILE * 2} height={GRASS_TILE * 2}>
            <image href={bimg(`texture-${tex}`)} x="0" y="0" width={GRASS_TILE} height={GRASS_TILE} preserveAspectRatio="none" />
            <g transform={`translate(${GRASS_TILE * 2} 0) scale(-1 1)`}>
              <image href={bimg(`texture-${tex}`)} x="0" y="0" width={GRASS_TILE} height={GRASS_TILE} preserveAspectRatio="none" />
            </g>
            <g transform={`translate(0 ${GRASS_TILE * 2}) scale(1 -1)`}>
              <image href={bimg(`texture-${tex}`)} x="0" y="0" width={GRASS_TILE} height={GRASS_TILE} preserveAspectRatio="none" />
            </g>
            <g transform={`translate(${GRASS_TILE * 2} ${GRASS_TILE * 2}) scale(-1 -1)`}>
              <image href={bimg(`texture-${tex}`)} x="0" y="0" width={GRASS_TILE} height={GRASS_TILE} preserveAspectRatio="none" />
            </g>
          </pattern>
        ))}
        {/* Formes de l'île (sable plein) et de l'herbe, pour masquer les textures */}
        <mask id="island-mask">
          <g filter="url(#gooey)">
            {islandCircles.map((c, i) => (
              <circle key={i} cx={c.x} cy={c.y} r={c.r} fill="#fff" />
            ))}
          </g>
        </mask>
        <mask id="grass-mask">
          <g filter="url(#gooey)">
            {islandCircles.map((c, i) => (
              <circle key={i} cx={c.x} cy={c.y} r={c.r * 0.72} fill="#fff" />
            ))}
          </g>
        </mask>
      </defs>

      {/* Fond : l'eau est la texture du conteneur, visible à travers le SVG */}

      {/* Écume au bord de l'île */}
      <g filter="url(#gooey)" opacity={0.65}>
        {islandCircles.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={c.r + 16} fill="#eef4ec" />
        ))}
      </g>

      {/* Île : sable texturé */}
      <g mask="url(#island-mask)">
        <rect
          x={-70} y={-12}
          width={viewBox.w + 110} height={viewBox.h + 24}
          fill="url(#tex-sable)"
        />
      </g>

      {/* Cœur d'herbe — frange claire de transition, puis texture peinte */}
      <g filter="url(#gooey)" opacity={0.85}>
        {islandCircles.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={c.r * 0.75} fill="#cdd9a0" />
        ))}
      </g>
      <g mask="url(#grass-mask)">
        <rect
          x={-70} y={-12}
          width={viewBox.w + 110} height={viewBox.h + 24}
          fill="url(#tex-herbe)"
        />
      </g>

      {/* Chemins : pierres de gué le long des courbes */}
      {Object.entries(board).map(([id, node]) =>
        node.next.map((toId) => {
          const target = board[toId];
          if (!target) return null;
          return (
            <g key={`${id}-${toId}`}>
              <SteppingStones x0={node.x} y0={node.y} x1={target.x} y1={target.y} />
            </g>
          );
        })
      )}
    </>
  );
});

// --- Mode « espace » (maps v2) : fond spatial + continents flottants ---
// Toutes les données (étoiles, nébuleuses, constellations, position des
// continents) viennent du mapComposer et sont persistées avec la partie :
// le rendu est pur et stable au resume.

// Lévitation : bob vertical très léger et asynchrone (paramètres amp/durée/
// déphasage générés par le mapComposer, persistés). Les socles d'un continent
// partagent le float de leur continent — ils bobbent EN PHASE avec lui.
// (keyframes sp-float dans le <style> du composant principal)
const floatStyle = (f) => (f ? {
  animation: `sp-float ${f.dur}s ease-in-out ${f.delay}s infinite`,
  '--sp-amp': `${f.amp}px`,
} : undefined);

// Traînée d'étoiles entre deux cases dont l'une au moins flotte dans l'espace
// (sur un continent, le chemin est déjà peint dans l'illustration).
function StardustTrail({ x0, y0, x1, y1 }) {
  const cx = x0 + (x1 - x0) * 0.5;
  const d = `M ${x0} ${y0} C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  return (
    <>
      <path d={d} fill="none" stroke="#cbb8ff" strokeWidth={7} strokeLinecap="round"
        strokeDasharray="0.5 22" opacity={0.18} />
      <path d={d} fill="none" stroke="#efe6ff" strokeWidth={3} strokeLinecap="round"
        strokeDasharray="0.5 22" opacity={0.55} />
    </>
  );
}

const SpaceTerrain = React.memo(function SpaceTerrain({ space, board, viewBox }) {
  const hues = [...new Set((space.nebulae || []).map((n) => n.hue))];
  const isIlot = (id) => (space.socles?.[id] || '').startsWith('ilot');
  return (
    <>
      <defs>
        <filter id="glow-active">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="sp-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#241245" />
          <stop offset="45%" stopColor="#2e1a55" />
          <stop offset="100%" stopColor="#170b30" />
        </linearGradient>
        {hues.map((h) => (
          <radialGradient key={h} id={`sp-neb-${h}`}>
            <stop offset="0%" stopColor={`hsla(${h}, 78%, 62%, 0.30)`} />
            <stop offset="55%" stopColor={`hsla(${h}, 80%, 52%, 0.12)`} />
            <stop offset="100%" stopColor={`hsla(${h}, 80%, 50%, 0)`} />
          </radialGradient>
        ))}
      </defs>

      {/* Fond : dégradé profond, débordant du viewBox (marges du <svg>) */}
      <rect x={-70} y={-12} width={viewBox.w + 110} height={viewBox.h + 24} fill="url(#sp-bg)" />

      {/* Nébuleuses */}
      {(space.nebulae || []).map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={`url(#sp-neb-${n.hue})`} />
      ))}

      {/* Champ d'étoiles (~8% scintillent) */}
      <g fill="#fff">
        {(space.stars || []).map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.tw ? 0.9 : 0.22 + (s.r - 0.7) * 0.3}>
            {s.tw === 1 && (
              <animate attributeName="opacity" values="0.9;0.15;0.9" dur={`${2.2 + (i % 5) * 0.7}s`} repeatCount="indefinite" />
            )}
          </circle>
        ))}
      </g>

      {/* Constellations (derrière les continents) */}
      <g stroke="rgba(216, 195, 255, 0.30)" strokeWidth={2}>
        {(space.constellations || []).map((c, ci) => (
          <g key={ci}>
            {c.links.map(([a, b], li) => (
              <line key={li} x1={c.pts[a].x} y1={c.pts[a].y} x2={c.pts[b].x} y2={c.pts[b].y} />
            ))}
            {c.pts.map((p, pi) => (
              <g key={pi} stroke="none">
                <circle cx={p.x} cy={p.y} r={7} fill="rgba(216, 195, 255, 0.18)" />
                <circle cx={p.x} cy={p.y} r={2.6} fill="#eee4ff" />
              </g>
            ))}
          </g>
        ))}
      </g>

      {/* Continents flottants (lévitation asynchrone) */}
      {(space.layers || []).map((l, i) => (
        <g key={i} style={floatStyle(l.float)}>
          <image href={simg(l.img)} x={l.x} y={l.y} width={l.w} height={l.h} />
        </g>
      ))}

      {/* Traînées d'étoiles entre les cases de l'espace */}
      {Object.entries(board).map(([id, node]) =>
        node.next.map((toId) => {
          const target = board[toId];
          if (!target) return null;
          if (!isIlot(id) && !isIlot(toId)) return null; // chemin peint sur le continent
          return <StardustTrail key={`${id}-${toId}`} x0={node.x} y0={node.y} x1={target.x} y1={target.y} />;
        })
      )}
    </>
  );
});

// Props thématiques + tuiles des cases : une seule couche triée par Y pour
// des chevauchements cohérents (prop devant une case → dessiné par-dessus,
// prop derrière → masqué par la tuile)
const DecorImage = ({ d, i }) => {
  const src = bimg(d.img);
  if (!src) return null;
  return (
    <image
      key={`dp-${i}`}
      href={src}
      x={d.x - d.w / 2} y={d.y - d.w / 2}
      width={d.w} height={d.w}
      preserveAspectRatio="xMidYMid meet"
    />
  );
};

const BoardItems = React.memo(function BoardItems({ board, boardDecor, space, choiceNodes, chooseJunction, tilePicking, selectTile, tilePickIcon, inspectTrapAt, trapTitle }) {
  return [
    ...(boardDecor || []).flatMap((d, i) => {
      if (!bimg(d.img)) return [];
      return [{ y: d.y, el: <DecorImage key={`dp-${i}`} d={d} i={i} /> }];
    }),
    ...Object.entries(board).map(([id, node]) => {
      const r = NODE_RADIUS[node.type] || 32;
      const isChoice = choiceNodes.has(id);

      // Visuel selon le type de case — largeurs depuis boardGeometry.TILE_SCALE
      let tile = null;
      // Mode espace : socle pierre (continent) ou îlot rocheux (espace), NU —
      // aucune indication de thème (choix de design maps v2). L'ancre logique
      // (node.x, node.y) est le centre de la FACE du socle, pas de l'image
      // (les îlots traînent des débris flottants sous eux). Les cases SPÉCIALES
      // (départ/arrivée/événement) ont leur propre plateforme gravée.
      let socleEl = null;
      if (space) {
        const socleKey = space.socles?.[id];
        const onContinent = (socleKey || '').startsWith('socle');
        const specialKey = SPECIAL_CASE_ASSET[node.type];
        if (specialKey && simg(specialKey)) {
          // Plateforme dédiée : remplace le socle générique (pas de monument/badge)
          const dims = SPACE_ASSET_DIMS[specialKey];
          const w = onContinent ? CASE_W_CONTINENT : CASE_W_SPACE;
          const h = (w * dims.h) / dims.w;
          const topDy = CASE_TOP_DY * h;
          socleEl = (
            <image
              href={simg(specialKey)}
              x={node.x - w / 2}
              y={node.y - topDy - h / 2}
              width={w}
              height={h}
              preserveAspectRatio="xMidYMid meet"
            />
          );
        } else {
          const dims = socleKey && SPACE_ASSET_DIMS[socleKey];
          if (dims && simg(socleKey)) {
            const ilot = socleKey.startsWith('ilot');
            const w = ilot ? ILOT_W : SOCLE_W;
            const h = (w * dims.h) / dims.w;
            const topDy = (ilot ? ILOT_TOP_DY : SOCLE_TOP_DY) * h;
            socleEl = (
              <image
                href={simg(socleKey)}
                x={node.x - w / 2}
                y={node.y - topDy - h / 2}
                width={w}
                height={h}
                preserveAspectRatio="xMidYMid meet"
              />
            );
          }
        }
      } else if (node.type === 'depart') {
        // Monument à la rose des vents (pierre + drapeau doré + laurier)
        tile = { src: bimg('socle-depart-v2'), w: r * 4.4, dy: -r * 0.85 };
      } else if (node.type === 'arrivee') {
        // Monument à l'étoile dorée et fanion
        tile = { src: bimg('socle-arrivee-v2'), w: r * TILE_SCALE.arrivee, dy: -r * 0.7 };
      } else if (node.type === 'jonction') {
        // Roue des matières : la jonction pose une question au hasard
        tile = { src: bimg('case-multi'), w: r * TILE_SCALE.jonction, dy: 0 };
      } else if (node.type === 'event') {
        // Socle au coffre — l'asset se suffit
        tile = { src: bimg('socle-event'), w: r * TILE_SCALE.event, dy: -r * 0.3 };
      } else if (node.type === 'subject') {
        // Cases gravées (le symbole de la matière est dans l'asset) ;
        // 'multi' = roue des matières
        const name = node.subject === 'multi' ? 'case-multi' : `case-${node.subject}`;
        tile = { src: bimg(name), w: r * TILE_SCALE.subject, dy: 0 };
      }

      const pickable = tilePicking && node.type !== 'arrivee';
      return { y: node.y, el: (
        <g
          key={id}
          className={pickable ? 'tile-pick' : undefined}
          onClick={isChoice ? () => chooseJunction(id) : (pickable ? () => selectTile(id) : undefined)}
          style={{
            cursor: (isChoice || pickable) ? 'pointer' : 'default',
            // lévitation : la case bobbe avec son continent (ou en solo si îlot)
            ...(space ? floatStyle(space.nodeFloat?.[id]) : null),
          }}
        >
          {isChoice && <ChoiceHighlight cx={node.x} cy={node.y} r={r} />}
          {pickable && (
            <>
              {/* anneau pulsant : case sélectionnable */}
              <circle cx={node.x} cy={node.y} r={r + 4} fill="rgba(201,71,47,0.12)"
                stroke="#c9472f" strokeWidth={3} strokeDasharray="7 5">
                <animate attributeName="stroke-dashoffset" from="0" to="24" dur="1s" repeatCount="indefinite" />
              </circle>
              {/* survol : halo plein + aperçu de l'icône du piège */}
              <g className="tile-pick-hover" style={{ pointerEvents: 'none' }}>
                <circle cx={node.x} cy={node.y} r={r + 10} fill="rgba(201,71,47,0.22)" stroke="#c9472f" strokeWidth={4} />
                <circle cx={node.x} cy={node.y} r={r + 16} fill="none" stroke="#f3c969" strokeWidth={2.5} opacity={0.8} />
                <text x={node.x} y={node.y - r - 14} textAnchor="middle" dominantBaseline="middle" fontSize={r * 0.85}
                  style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))' }}>
                  {tilePickIcon || '\u{1FAA4}'}
                </text>
              </g>
            </>
          )}

          {socleEl}
          {tile && tile.src ? (
            <image
              href={tile.src}
              x={node.x - tile.w / 2}
              y={node.y - tile.w / 2 + tile.dy}
              width={tile.w}
              height={tile.w}
              preserveAspectRatio="xMidYMid meet"
            />
          ) : socleEl ? null : (
            // Filet de sécurité si un asset manque : couleur + emoji lisibles
            <>
              <circle cx={node.x} cy={node.y} r={r} fill={SUBJECTS[node.subject]?.color || '#d9cda5'} stroke="#a3946f" strokeWidth={2} />
              <text
                x={node.x} y={node.y + 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={r * 0.62}
                style={{ pointerEvents: 'none' }}
              >
                {SUBJECTS[node.subject]?.icon
                  || (node.type === 'depart' ? '\u{1F3F0}' : node.type === 'arrivee' ? '\u{1F3C6}' : node.type === 'event' ? '\u{1F381}' : '❓')}
              </text>
            </>
          )}

          {/* Mode espace : la plateforme case-event porte déjà les symboles
              d'événement → plus de badge coffre (l'asset se suffit). */}
          {node.trap && (
            <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); inspectTrapAt?.(id); }}>
              <title>{trapTitle}</title>
              {simg('piege') ? (
                // Marqueur de piège dédié (plateforme d'énergie), flottant au-dessus
                (() => {
                  const pd = SPACE_ASSET_DIMS.piege;
                  const pw = PIEGE_W;
                  const ph = (pw * pd.h) / pd.w;
                  return (
                    <image
                      href={simg('piege')}
                      x={node.x - pw / 2}
                      y={node.y - r * 0.9 - ph / 2}
                      width={pw}
                      height={ph}
                      preserveAspectRatio="xMidYMid meet"
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                    />
                  );
                })()
              ) : (
                <>
                  <circle cx={node.x} cy={node.y - r * 0.9} r={r * 0.42} fill="#2b1c10" stroke="#c9472f" strokeWidth={2} opacity={0.92} />
                  <text x={node.x} y={node.y - r * 0.9 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={r * 0.5} style={{ pointerEvents: 'none' }}>
                    {node.trap.icon || '\u{1FAA4}'}
                  </text>
                </>
              )}
            </g>
          )}
        </g>
      ) };
    }),
  ].sort((a, b) => a.y - b.y).map((it) => it.el);
});

// Camera spring config
const CAMERA_SPRING = { damping: 25, stiffness: 80, mass: 1 };

// --- Point de contrôle : socle gravé + cristal animé (4 frames en boucle) ---
const CP_W = 122;                       // largeur du socle (unités viewBox)
const CP_H = CP_W * (622 / 795);        // ratio de l'asset
const CP_HOLE_DY = 0.46;                // le trou est à ~46 % de la hauteur (depuis le haut)
const CRY_W = 34, CRY_H = 66;           // boîte du cristal (ancré par la base)
const CP_CRY_FRAMES = ['checkpoint-cristal-1', 'checkpoint-cristal-2', 'checkpoint-cristal-3', 'checkpoint-cristal-4'].map(simg);
const CRYSTAL_HUE = 205;                // teinte dominante du cristal bleu d'origine

// Teinte (degrés HSV) d'une couleur #rrggbb — pour recolorer le cristal par
// rotation de teinte (garde l'éclat et les étincelles blanches).
function hexHue(hex) {
  const h = (hex || '').replace('#', '');
  if (h.length < 6) return CRYSTAL_HUE;
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 0.02) return CRYSTAL_HUE;
  let hue; if (mx === r) hue = ((g - b) / d) % 6; else if (mx === g) hue = (b - r) / d + 2; else hue = (r - g) / d + 4;
  hue *= 60; if (hue < 0) hue += 360; return hue;
}

const Checkpoints = React.memo(function Checkpoints({ board, teams, space, currentTeam, onTeleport, teleportLabel }) {
  const socle = simg('checkpoint-socle');
  if (!socle) return null;
  // Un marqueur par NŒUD checkpoint (couleur = équipe qui l'a posé ; la 1re si partagé).
  const byNode = new Map();
  for (const t of (teams || [])) if (t.checkpoint && board[t.checkpoint] && !byNode.has(t.checkpoint)) byNode.set(t.checkpoint, t.color);
  if (!byNode.size) return null;
  const myNode = teams?.[currentTeam]?.checkpoint; // le checkpoint de l'équipe ACTIVE est cliquable
  return [...byNode.entries()].map(([id, color]) => {
    const node = board[id];
    const rot = Math.round((hexHue(color) - CRYSTAL_HUE + 360) % 360);
    const mine = id === myNode && id !== teams[currentTeam]?.pos; // pas déjà dessus
    const topY = node.y - CP_HOLE_DY * CP_H;
    return (
      <g key={`cp-${id}`} style={space ? floatStyle(space.nodeFloat?.[id]) : undefined}
        pointerEvents={mine ? 'auto' : 'none'}
        onClick={mine ? onTeleport : undefined}
        {...(mine ? { className: 'cp-clickable' } : {})}>
        {/* Socle : le trou central tombe sur (node.x, node.y) */}
        <image href={socle} x={node.x - CP_W / 2} y={topY} width={CP_W} height={CP_H}
          preserveAspectRatio="xMidYMid meet" style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.45))' }} />
        {/* Cristal : 4 frames superposées (boucle), teinté à la couleur d'équipe */}
        {CP_CRY_FRAMES.map((f, i) => f && (
          <image key={i} href={f} x={node.x - CRY_W / 2} y={node.y + 3 - CRY_H} width={CRY_W} height={CRY_H}
            preserveAspectRatio="xMidYMax meet"
            style={{ animation: `cp-f${i} 0.8s infinite`, filter: `hue-rotate(${rot}deg) drop-shadow(0 0 5px ${color})` }} />
        ))}
        {/* Étiquette « Me téléporter » — visible pour le propriétaire à son tour */}
        {mine && (
          <motion.g initial={{ opacity: 0.75, y: 0 }} animate={{ opacity: [0.75, 1, 0.75], y: [0, -2, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }} style={{ cursor: 'pointer' }}>
            <rect x={node.x - 52} y={topY - 26} width={104} height={22} rx={11}
              fill="rgba(12,18,28,0.92)" stroke={color} strokeWidth={2} />
            <text x={node.x} y={topY - 15} textAnchor="middle" dominantBaseline="middle"
              fontSize={12} fill="#e8f3ff" fontFamily="var(--font-ui)" fontWeight={700}>{teleportLabel}</text>
          </motion.g>
        )}
      </g>
    );
  });
});

export default function BoardSVG() {
  const T = useT();
  const board = useGameStore((s) => s.board);
  const boardDecor = useGameStore((s) => s.boardDecor);
  const boardSpace = useGameStore((s) => s.boardSpace);
  const viewBox = useGameStore((s) => s.viewBox);
  const teams = useGameStore((s) => s.teams);
  const awaitingChoice = useGameStore((s) => s.awaitingChoice);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const chooseJunction = useGameStore((s) => s.chooseJunction);
  const showTilePicker = useGameStore((s) => s.showTilePicker);
  const selectTile = useGameStore((s) => s.selectTile);
  const movePath = useGameStore((s) => s.movePath);
  const clearTeamMove = useGameStore((s) => s.clearTeamMove);
  const inspectTrapAt = useGameStore((s) => s.inspectTrapAt);
  const teleportToCheckpoint = useGameStore((s) => s.teleportToCheckpoint);

  const containerRef = useRef(null);
  const svgRef = useRef(null);

  // Compute pawn target positions (final, for when not animating)
  const pawnPositions = useMemo(() => {
    if (!board || !teams.length) return [];
    const groups = {};
    teams.forEach((t, i) => {
      if (!groups[t.pos]) groups[t.pos] = [];
      groups[t.pos].push(i);
    });
    return teams.map((t, i) => {
      const node = board[t.pos];
      if (!node) return { px: 0, py: 0 };
      const group = groups[t.pos];
      const indexInGroup = group.indexOf(i);
      const count = group.length;
      const angle = (indexInGroup / Math.max(count, 1)) * 2 * Math.PI - Math.PI / 2;
      const spread = count === 1 ? 0 : 36;
      return {
        px: node.x + spread * Math.cos(angle),
        py: node.y + spread * Math.sin(angle),
      };
    });
  }, [board, teams]);

  // Camera follow: scroll to active team's pawn
  useEffect(() => {
    if (!board || !teams.length || !containerRef.current || !svgRef.current) return;
    const team = teams[currentTeam];
    if (!team) return;
    const node = board[team.pos];
    if (!node) return;

    const container = containerRef.current;
    const svg = svgRef.current;
    const svgWidth = svg.clientWidth || svg.getBoundingClientRect().width;
    const containerWidth = container.clientWidth;

    // Convert node.x from viewBox coords to pixel coords
    const scale = svgWidth / viewBox.w;
    const targetPixelX = node.x * scale;

    // Center the pawn in the container. En mode espace le plateau est aussi
    // HAUT (éventail de continents parallèles) : on centre également en y.
    const scrollTarget = targetPixelX - containerWidth / 2;
    const scrollTargetY = node.y * scale - container.clientHeight / 2;
    container.scrollTo({ left: Math.max(0, scrollTarget), top: Math.max(0, scrollTargetY), behavior: 'smooth' });
  }, [board, teams, currentTeam, viewBox]);

  // Île procédurale : cercles disposés le long des cases et des chemins
  // (boardGeometry, partagé avec decorGenerator), fusionnés en forme
  // organique par le filtre "gooey" (blur + seuil alpha).
  // Inutile en mode espace (le terrain est un continent peint).
  const islandCircles = useMemo(
    () => (board && !boardSpace ? buildIslandCircles(board) : []),
    [board, boardSpace]
  );

  const choiceNodes = useMemo(() => {
    const set = new Set();
    if (awaitingChoice && teams[currentTeam]) {
      const node = board[teams[currentTeam].pos];
      if (node) node.next.forEach((id) => set.add(id));
    }
    return set;
  }, [awaitingChoice, currentTeam, board, teams]);

  const onMoveComplete = useCallback((teamIndex) => {
    clearTeamMove(teamIndex);
  }, [clearTeamMove]);

  if (!board) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-auto"
      style={boardSpace ? {
        // Espace : le fond du conteneur prolonge le dégradé du SVG (zones
        // au-delà du viewBox lors du scroll caméra)
        background: 'linear-gradient(180deg, #241245 0%, #2e1a55 45%, #170b30 100%)',
      } : {
        background: `url(${bimg('texture-eau')}) repeat`,
        backgroundSize: '460px 460px',
      }}
    >
      <style>{`
        .tile-pick-hover { opacity: 0; transition: opacity 120ms ease; }
        .tile-pick:hover .tile-pick-hover { opacity: 1; }
        .tile-pick:hover { filter: drop-shadow(0 0 10px rgba(201,71,47,0.8)); }
        /* Lévitation des continents/îlots de l'espace (amplitude par élément
           via --sp-amp, phase désynchronisée via animation-delay négatif) */
        @keyframes sp-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(calc(var(--sp-amp, 5px) * -1)); }
        }
        .cp-clickable { cursor: pointer; }
        .cp-clickable:hover { filter: drop-shadow(0 0 10px rgba(120,190,255,0.85)); }
        /* Cristal du point de contrôle : 4 frames jouées en boucle (une visible à la fois) */
        @keyframes cp-f0 { 0%,24.9%{opacity:1} 25%,100%{opacity:0} }
        @keyframes cp-f1 { 0%,24.9%{opacity:0} 25%,49.9%{opacity:1} 50%,100%{opacity:0} }
        @keyframes cp-f2 { 0%,49.9%{opacity:0} 50%,74.9%{opacity:1} 75%,100%{opacity:0} }
        @keyframes cp-f3 { 0%,74.9%{opacity:0} 75%,100%{opacity:1} }
      `}</style>
      {showTilePicker && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 70,
          padding: '10px 20px', borderRadius: 999,
          background: 'linear-gradient(180deg, #fff3d4, #f0d99a)',
          border: '2px solid #c9472f', color: '#7a2218',
          fontFamily: 'var(--font-display)', fontSize: 16,
          boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
        }}>
          {'\u{1FAA4}'} {showTilePicker.label
            ? T('game.placeTrapPromptNamed', { label: showTilePicker.label })
            : T('game.placeTrapPrompt')}
          <button onClick={() => useGameStore.getState().cancelTilePicker()}
            style={{ marginLeft: 14, background: 'none', border: 'none', color: '#7a2218', cursor: 'pointer', fontWeight: 700 }}>
            {T('common.cancel')}
          </button>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`-70 -12 ${viewBox.w + 110} ${viewBox.h + 24}`}
        className="block"
        style={{ minWidth: Math.max(1200, Math.round(viewBox.w / 1.2)) + 'px' }}
      >
        {boardSpace ? (
          <SpaceTerrain space={boardSpace} board={board} viewBox={viewBox} />
        ) : (
          <Terrain board={board} islandCircles={islandCircles} viewBox={viewBox} />
        )}

        <BoardItems board={board} boardDecor={boardSpace ? null : boardDecor} space={boardSpace} choiceNodes={choiceNodes} chooseJunction={chooseJunction} tilePicking={!!showTilePicker} selectTile={selectTile} tilePickIcon={showTilePicker?.icon} inspectTrapAt={inspectTrapAt} trapTitle={T('game.seeTrapEffect')} />

        {/* Points de contrôle posés (socle + cristal animé) — cliquable par le propriétaire */}
        <Checkpoints board={board} teams={teams} space={boardSpace} currentTeam={currentTeam}
          onTeleport={teleportToCheckpoint} teleportLabel={T('game.checkpointTeleport')} />

        {/* Animated Pawns */}
        <PawnDefs colors={[...new Set(teams.map((t) => t.color))]} />
        {teams.map((team, idx) => {
          const pos = pawnPositions[idx];
          if (!pos) return null;
          const move = movePath?.find((m) => m.teamIndex === idx) || null;
          return (
            <Pawn
              key={idx}
              team={team}
              idx={idx}
              px={pos.px}
              py={pos.py}
              isActive={idx === currentTeam}
              move={move}
              onMoveComplete={onMoveComplete}
              float={boardSpace?.nodeFloat?.[team.pos]}
            />
          );
        })}
      </svg>
    </div>
  );
}
