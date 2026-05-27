import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { SUBJECTS } from '../../data/subjects';

const NODE_COLORS = {
  depart: '#5a4628',
  arrivee: '#b8862c',
  jonction: '#7a5e3a',
  event: '#a83e7f',
};

const NODE_ICONS = {
  depart: '\u{1F3C1}',
  arrivee: '\u{1F3C6}',
  jonction: '\u2726',
  event: '\u{1F381}',
};

const NODE_RADIUS = {
  depart: 36,
  arrivee: 36,
  jonction: 26,
  event: 30,
  subject: 32,
};

const pawnTransition = { type: 'spring', damping: 18, stiffness: 120, mass: 0.8 };

function Pawn({ team, idx, px, py, isActive }) {
  return (
    <motion.g
      animate={{ x: px, y: py }}
      transition={pawnTransition}
      style={{ x: px, y: py }}
    >
      {isActive && (
        <motion.circle
          cx={0} cy={0} r={20}
          fill="none" stroke={team.color} strokeWidth={3}
          initial={{ opacity: 0.3, scale: 0.8 }}
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <motion.circle
        cx={0} cy={0} r={16}
        fill="white" stroke={team.color}
        strokeWidth={isActive ? 4 : 3}
        filter={isActive ? 'url(#glow-active)' : undefined}
        whileHover={{ scale: 1.15 }}
      />
      <text
        x={0} y={1}
        textAnchor="middle" dominantBaseline="central"
        fontSize={20} style={{ pointerEvents: 'none' }}
      >
        {team.emoji}
      </text>
    </motion.g>
  );
}

function ChoiceHighlight({ cx, cy, r }) {
  return (
    <motion.circle
      cx={cx} cy={cy} r={r + 6}
      fill="none" stroke="#facc15" strokeWidth={4}
      initial={{ opacity: 0.4, scale: 0.9 }}
      animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.05, 0.9] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

function lightenHex(hex, amount) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const r = Math.min(255, ((n >> 16) & 255) + Math.round((255 - ((n >> 16) & 255)) * amount));
  const g = Math.min(255, ((n >> 8) & 255) + Math.round((255 - ((n >> 8) & 255)) * amount));
  const b = Math.min(255, (n & 255) + Math.round((255 - (n & 255)) * amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function darkenHex(hex, amount) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amount));
  const g = Math.round(((n >> 8) & 255) * (1 - amount));
  const b = Math.round((n & 255) * (1 - amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export default function BoardSVG() {
  const board = useGameStore((s) => s.board);
  const viewBox = useGameStore((s) => s.viewBox);
  const teams = useGameStore((s) => s.teams);
  const awaitingChoice = useGameStore((s) => s.awaitingChoice);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const chooseJunction = useGameStore((s) => s.chooseJunction);

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
      const spread = count === 1 ? 0 : 24;
      return {
        px: node.x + spread * Math.cos(angle),
        py: node.y + spread * Math.sin(angle),
      };
    });
  }, [board, teams]);

  if (!board) return null;

  const entries = Object.entries(board);

  const choiceNodes = new Set();
  if (awaitingChoice) {
    const team = teams[currentTeam];
    const node = board[team.pos];
    if (node) node.next.forEach((id) => choiceNodes.add(id));
  }

  return (
    <div
      className="absolute inset-0 overflow-auto"
      style={{
        background: 'radial-gradient(ellipse at 50% 30%, rgba(255,240,194,0.55), transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(91,140,58,0.10), transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(45,140,110,0.10), transparent 50%)',
      }}
    >
      <svg
        viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
        className="block"
        style={{ minWidth: Math.max(900, Math.round(viewBox.w / 1.5)) + 'px' }}
      >
        <defs>
          <filter id="glow-active">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="hex-shadow" x="-20%" y="-10%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity="0.28" />
          </filter>
        </defs>

        {/* Paths */}
        {entries.map(([id, node]) =>
          node.next.map((toId) => {
            const target = board[toId];
            if (!target) return null;
            const dx = target.x - node.x;
            const cx1 = node.x + dx * 0.5;
            return (
              <path
                key={`${id}-${toId}`}
                d={`M ${node.x} ${node.y} C ${cx1} ${node.y}, ${cx1} ${target.y}, ${target.x} ${target.y}`}
                fill="none"
                stroke="rgba(122, 94, 58, 0.35)"
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={node.type === 'jonction' ? '8 12' : '1 12'}
              />
            );
          })
        )}

        {/* Nodes */}
        {entries.map(([id, node]) => {
          let fill, icon;
          if (node.type === 'subject') {
            const s = SUBJECTS[node.subject];
            fill = s?.color || '#888';
            icon = s?.icon || '?';
          } else {
            fill = NODE_COLORS[node.type] || '#888';
            icon = NODE_ICONS[node.type] || '?';
          }
          const r = NODE_RADIUS[node.type] || 32;
          const isChoice = choiceNodes.has(id);

          const lightFill = lightenHex(fill, 0.15);
          const darkFill = darkenHex(fill, 0.25);
          const depth = Math.max(3, r * 0.12);

          return (
            <g
              key={id}
              onClick={isChoice ? () => chooseJunction(id) : undefined}
              style={{ cursor: isChoice ? 'pointer' : 'default' }}
            >
              {isChoice && <ChoiceHighlight cx={node.x} cy={node.y} r={r} />}

              {/* Shadow/depth circle */}
              <circle
                cx={node.x} cy={node.y + depth} r={r}
                fill={darkFill}
                filter="url(#hex-shadow)"
              />

              {/* Main circle with gradient feel */}
              <circle
                cx={node.x} cy={node.y} r={r}
                fill={fill} stroke={darkFill} strokeWidth={2}
              />

              {/* Top highlight */}
              <ellipse
                cx={node.x - r * 0.15} cy={node.y - r * 0.2}
                rx={r * 0.5} ry={r * 0.3}
                fill="rgba(255,255,255,0.25)"
              />

              {/* Icon */}
              <text
                x={node.x} y={node.y + 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={r * 0.7} fill="white"
                style={{ pointerEvents: 'none' }}
              >
                {icon}
              </text>
              {(node.type === 'depart' || node.type === 'arrivee') && (
                <text
                  x={node.x} y={node.y + r + 18}
                  textAnchor="middle" fontSize={13} fontWeight={700}
                  fill="var(--ink-700)"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {node.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Animated Pawns */}
        {teams.map((team, idx) => {
          const pos = pawnPositions[idx];
          if (!pos) return null;
          return (
            <Pawn
              key={idx}
              team={team}
              idx={idx}
              px={pos.px}
              py={pos.py}
              isActive={idx === currentTeam}
            />
          );
        })}
      </svg>
    </div>
  );
}
