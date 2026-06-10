import { useGameStore } from '../../store/gameStore';
import { SUBJECTS } from '../../data/subjects';

const TILE_TYPES = {
  depart:   { icon: '\u{1F3F0}', label: 'Départ' },
  arrivee:  { icon: '\u{1F3C6}', label: 'Arrivée' },
  jonction: { icon: '\u{1F3B2}', label: 'Carrefour' },
  event:    { icon: '✨',        label: 'Événement' },
};

// Position lisible d'une equipe sur le plateau (biome ou type de case)
function locationLabel(board, pos) {
  const node = board?.[pos];
  if (!node) return null;
  if (node.type === 'subject' && node.subject !== 'multi') {
    const s = SUBJECTS[node.subject];
    if (s) return { icon: s.icon, text: s.biome || s.name };
  }
  if (node.type === 'subject') return { icon: '\u{1F500}', text: 'Case multi' };
  const t = TILE_TYPES[node.type];
  return t ? { icon: t.icon, text: t.label } : null;
}

/**
 * Bouton de selection d'equipe cible, enrichi : or possede + position.
 * Utilise par TargetPickerModal (pouvoirs) et EventModal (evenements).
 */
export default function TeamTargetButton({ team, onClick, hoverColor = '#e85d6b', hoverBg = '#fef2f2' }) {
  const board = useGameStore((s) => s.board);
  const loc = locationLabel(board, team.pos);

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px', borderRadius: 14,
        border: '2px solid rgba(122,94,58,0.22)',
        background: '#fffefb',
        cursor: 'pointer', fontFamily: 'var(--font-ui)',
        transition: 'all 100ms ease',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = hoverColor; e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(122,94,58,0.22)'; e.currentTarget.style.background = '#fffefb'; }}
    >
      <span className="text-2xl" style={{ flexShrink: 0 }}>{team.emoji}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--font-display)', color: team.color, display: 'block' }}>
          {team.name}
        </span>
        {loc && (
          <span style={{ fontSize: 11, color: 'var(--ink-500)', display: 'block', marginTop: 1 }}>
            {loc.icon} {loc.text}
          </span>
        )}
      </span>
      <span
        style={{
          flexShrink: 0,
          padding: '3px 10px', borderRadius: 999,
          background: 'linear-gradient(180deg, #fff5d0, #f3d997)',
          border: '1px solid rgba(184, 134, 44, 0.4)',
          fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--ink-900)',
        }}
      >
        {team.money ?? 0} <span className="coin" />
      </span>
    </button>
  );
}
