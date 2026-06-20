import { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { generateBoard } from '../../logic/boardGenerator';
import { SUBJECTS } from '../../data/subjects';
import { useT } from '../../i18n';

// Mini-schéma du plateau (aperçu au Setup) : réutilise le VRAI générateur
// (geométrie déterministe x/y) pour montrer d'un coup d'œil longueur × largeur.
// Se met à jour en direct quand on bouge les curseurs (mêmes params du store).
const TYPE_FILL = {
  depart: '#2f9d5a',
  arrivee: '#e85d6b',
  jonction: '#caa23a',
  event: '#a371e0',
};

export default function BoardPreview() {
  const T = useT();
  const params = useGameStore((s) => s.boardParams);
  const subjects = useGameStore((s) => s.selectedSubjects);

  const built = useMemo(() => {
    try {
      const subj = Array.isArray(subjects) && subjects.length ? subjects : undefined;
      return generateBoard({ ...params, subjects: subj });
    } catch {
      return null;
    }
  }, [params, subjects]);

  if (!built) return null;
  const { nodes, viewBox } = built;
  const entries = Object.values(nodes);

  const edges = [];
  for (const n of entries) {
    for (const nx of n.next) {
      const t = nodes[nx];
      if (t) edges.push({ x1: n.x, y1: n.y, x2: t.x, y2: t.y });
    }
  }

  const fillFor = (n) => TYPE_FILL[n.type] || (n.subject && SUBJECTS[n.subject]?.color) || '#d9c8a0';
  const radiusFor = (n) => (n.type === 'depart' || n.type === 'arrivee' ? 46 : 30);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 6 }}>
        {T('setup.boardPreviewDims', { voies: params.nbVoies, sections: params.nbSections, cases: params.casesParVoie })}
      </div>
      <div style={{
        background: 'linear-gradient(180deg,#fbf3df,#f3e7c9)',
        border: '1px solid rgba(122,94,58,0.22)', borderRadius: 12, padding: 8,
      }}>
        <svg
          viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: 'auto', maxHeight: 200, display: 'block' }}
          role="img"
          aria-label={T('setup.boardPreviewAria')}
        >
          {edges.map((e, i) => (
            <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="rgba(122,94,58,0.35)" strokeWidth={8} strokeLinecap="round" />
          ))}
          {entries.map((n, i) => (
            <circle
              key={i}
              cx={n.x} cy={n.y} r={radiusFor(n)}
              fill={fillFor(n)}
              stroke="rgba(60,40,10,0.35)" strokeWidth={4}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
