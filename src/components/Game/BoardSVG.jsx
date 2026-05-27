import { useGameStore } from '../../store/gameStore';
import { SUBJECTS } from '../../data/subjects';

const NODE_COLORS = {
  depart: '#14532d',
  arrivee: '#7c2d12',
  jonction: '#6b7280',
  event: '#ec4899',
};

const NODE_ICONS = {
  depart: '\u{1F6A9}',
  arrivee: '\u{1F3C1}',
  jonction: '?',
  event: '\u{1F381}',
};

const NODE_RADIUS = {
  depart: 36,
  arrivee: 36,
  jonction: 26,
  event: 30,
  subject: 32,
};

export default function BoardSVG() {
  const board = useGameStore((s) => s.board);
  const viewBox = useGameStore((s) => s.viewBox);
  const teams = useGameStore((s) => s.teams);
  const awaitingChoice = useGameStore((s) => s.awaitingChoice);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const chooseJunction = useGameStore((s) => s.chooseJunction);

  if (!board) return null;

  const entries = Object.entries(board);

  // Build pawn groups by position
  const pawnGroups = {};
  teams.forEach((t, i) => {
    if (!pawnGroups[t.pos]) pawnGroups[t.pos] = [];
    pawnGroups[t.pos].push({ team: t, idx: i });
  });

  // If awaiting choice, find clickable nodes
  const choiceNodes = new Set();
  if (awaitingChoice) {
    const team = teams[currentTeam];
    const node = board[team.pos];
    if (node) node.next.forEach((id) => choiceNodes.add(id));
  }

  return (
    <div className="flex-1 overflow-auto bg-[var(--bg)]">
      <svg
        viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
        className="block"
        style={{ minWidth: Math.max(900, Math.round(viewBox.w / 1.5)) + 'px' }}
      >
        {/* Defs for glow filter */}
        <defs>
          <filter id="glow-active">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Paths */}
        {entries.map(([id, node]) =>
          node.next.map((toId) => {
            const target = board[toId];
            if (!target) return null;
            const dx = target.x - node.x;
            const c1x = node.x + dx * 0.5;
            const c2x = node.x + dx * 0.5;
            return (
              <path
                key={`${id}-${toId}`}
                d={`M ${node.x} ${node.y} C ${c1x} ${node.y}, ${c2x} ${target.y}, ${target.x} ${target.y}`}
                fill="none"
                stroke="#d4cfbf"
                strokeWidth={3}
                strokeDasharray={node.type === 'jonction' ? '8 4' : 'none'}
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

          return (
            <g
              key={id}
              onClick={isChoice ? () => chooseJunction(id) : undefined}
              style={{ cursor: isChoice ? 'pointer' : 'default' }}
            >
              {isChoice && (
                <circle
                  cx={node.x} cy={node.y} r={r + 6}
                  fill="none" stroke="#facc15" strokeWidth={4}
                  className="animate-pulse"
                />
              )}
              <circle
                cx={node.x} cy={node.y} r={r}
                fill={fill} stroke="#fff" strokeWidth={3}
              />
              <text
                x={node.x} y={node.y + 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={22} fill="white"
                style={{ pointerEvents: 'none' }}
              >
                {icon}
              </text>
              {(node.type === 'depart' || node.type === 'arrivee') && (
                <text
                  x={node.x} y={node.y + r + 18}
                  textAnchor="middle" fontSize={13} fontWeight={700}
                  fill="var(--ink)"
                >
                  {node.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Pawns */}
        {Object.entries(pawnGroups).map(([posId, list]) => {
          const node = board[posId];
          if (!node) return null;
          return list.map((item, i) => {
            const angle = (i / Math.max(list.length, 1)) * 2 * Math.PI - Math.PI / 2;
            const spread = list.length === 1 ? 0 : 24;
            const px = node.x + spread * Math.cos(angle);
            const py = node.y + spread * Math.sin(angle);
            const isActive = item.idx === currentTeam;

            return (
              <g key={item.idx}>
                {/* Active team glow */}
                {isActive && (
                  <circle
                    cx={px} cy={py} r={20}
                    fill="none" stroke={item.team.color} strokeWidth={3}
                    opacity={0.5}
                    className="animate-pulse"
                  />
                )}
                <circle
                  cx={px} cy={py} r={16}
                  fill="white" stroke={item.team.color}
                  strokeWidth={isActive ? 4 : 3}
                  filter={isActive ? 'url(#glow-active)' : undefined}
                  style={{ transition: 'all 0.3s ease' }}
                />
                <text
                  x={px} y={py + 1}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={20} style={{ pointerEvents: 'none' }}
                >
                  {item.team.emoji}
                </text>
              </g>
            );
          });
        })}
      </svg>
    </div>
  );
}
