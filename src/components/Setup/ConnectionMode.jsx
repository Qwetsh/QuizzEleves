// Hub de connexion (Setup) : choisir comment les équipes sont créées.
//  - 'board'  : à l'ancienne, le prof crée les équipes au tableau.
//  - 'phone'  : les élèves créent leur équipe depuis leur téléphone (lobby + QR).
import { useGameStore } from '../../store/gameStore';

const OPTS = [
  { id: 'board', icon: '🖥️', label: 'Au tableau', desc: 'Tu crées les équipes ici.' },
  { id: 'phone', icon: '📱', label: 'Par téléphone', desc: 'Les élèves créent leur équipe via QR.' },
];

export default function ConnectionMode() {
  const mode = useGameStore((s) => s.connectionMode);
  const setMode = useGameStore((s) => s.setConnectionMode);

  return (
    <div>
      <div className="field-label" style={{ marginBottom: 8 }}>🔗 Connexion des équipes</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {OPTS.map((o) => {
          const on = mode === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setMode(o.id)}
              style={{
                flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                border: `2px solid ${on ? 'var(--gold-600)' : 'rgba(122,94,58,0.2)'}`,
                background: on ? 'rgba(232,169,88,0.1)' : '#fffefb',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span>{o.icon}</span>{o.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2, lineHeight: 1.3 }}>{o.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
