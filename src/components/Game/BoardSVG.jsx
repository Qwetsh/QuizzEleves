import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { SUBJECTS } from '../../data/subjects';
import { NODE_RADIUS, TILE_SCALE, islandCircles as buildIslandCircles, bezierPoint } from '../../logic/boardGeometry';

// Assets du plateau (refonte pierre & jungle) — voir scripts/name-assets.mjs
const BOARD_ASSET_URLS = import.meta.glob('../../assets/board/*.{png,jpg}', { eager: true, query: '?url', import: 'default' });
const BOARD_ASSETS = Object.fromEntries(
  Object.entries(BOARD_ASSET_URLS).map(([p, url]) => [p.split('/').pop().replace(/\.(png|jpg)$/, ''), url])
);
const bimg = (name) => BOARD_ASSETS[name];

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

const Pawn = React.memo(function Pawn({ team, idx, px, py, isActive, move, onMoveComplete }) {
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

  return (
    <motion.g
      animate={{ x: animPos.x, y: animPos.y }}
      transition={{ type: 'spring', damping: 22, stiffness: 180, mass: 0.6 }}
    >
      {isActive && !isBack && (
        <motion.circle
          cx={0} cy={0} r={30}
          fill="none" stroke={team.color} strokeWidth={3.5}
          initial={{ opacity: 0.3, scale: 0.8 }}
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {isBack && (
        <motion.circle
          cx={0} cy={0} r={30}
          fill="none" stroke="#c9472f" strokeWidth={3.5}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.7, 0], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <motion.circle
        cx={0} cy={0} r={24}
        fill="white" stroke={isBack ? '#c9472f' : team.color}
        strokeWidth={isActive ? 5 : 3.5}
        filter={isActive ? 'url(#glow-active)' : undefined}
        whileHover={{ scale: 1.15 }}
      />
      <text
        x={0} y={1}
        textAnchor="middle" dominantBaseline="central"
        fontSize={28} style={{ pointerEvents: 'none' }}
      >
        {team.emoji}
      </text>
    </motion.g>
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

const BoardItems = React.memo(function BoardItems({ board, boardDecor, choiceNodes, chooseJunction }) {
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
      if (node.type === 'depart') {
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

      return { y: node.y, el: (
        <g
          key={id}
          onClick={isChoice ? () => chooseJunction(id) : undefined}
          style={{ cursor: isChoice ? 'pointer' : 'default' }}
        >
          {isChoice && <ChoiceHighlight cx={node.x} cy={node.y} r={r} />}

          {tile && tile.src ? (
            <image
              href={tile.src}
              x={node.x - tile.w / 2}
              y={node.y - tile.w / 2 + tile.dy}
              width={tile.w}
              height={tile.w}
              preserveAspectRatio="xMidYMid meet"
            />
          ) : (
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
        </g>
      ) };
    }),
  ].sort((a, b) => a.y - b.y).map((it) => it.el);
});

// Camera spring config
const CAMERA_SPRING = { damping: 25, stiffness: 80, mass: 1 };

export default function BoardSVG() {
  const board = useGameStore((s) => s.board);
  const boardDecor = useGameStore((s) => s.boardDecor);
  const viewBox = useGameStore((s) => s.viewBox);
  const teams = useGameStore((s) => s.teams);
  const awaitingChoice = useGameStore((s) => s.awaitingChoice);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const chooseJunction = useGameStore((s) => s.chooseJunction);
  const movePath = useGameStore((s) => s.movePath);
  const clearTeamMove = useGameStore((s) => s.clearTeamMove);

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

    // Center the pawn in the container
    const scrollTarget = targetPixelX - containerWidth / 2;
    container.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
  }, [board, teams, currentTeam, viewBox]);

  // Île procédurale : cercles disposés le long des cases et des chemins
  // (boardGeometry, partagé avec decorGenerator), fusionnés en forme
  // organique par le filtre "gooey" (blur + seuil alpha).
  const islandCircles = useMemo(() => (board ? buildIslandCircles(board) : []), [board]);

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
      style={{
        background: `url(${bimg('texture-eau')}) repeat`,
        backgroundSize: '460px 460px',
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`-70 -12 ${viewBox.w + 110} ${viewBox.h + 24}`}
        className="block"
        style={{ minWidth: Math.max(1200, Math.round(viewBox.w / 1.2)) + 'px' }}
      >
        <Terrain board={board} islandCircles={islandCircles} viewBox={viewBox} />

        <BoardItems board={board} boardDecor={boardDecor} choiceNodes={choiceNodes} chooseJunction={chooseJunction} />

        {/* Animated Pawns */}
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
            />
          );
        })}
      </svg>
    </div>
  );
}
