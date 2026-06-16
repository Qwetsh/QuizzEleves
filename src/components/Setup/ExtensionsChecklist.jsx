import { useGameStore } from '../../store/gameStore';
import { EXTENSIONS, extOn } from '../../extensions/registry';

// Sélecteur des EXTENSIONS de la partie (modules activables). Choisi au Setup,
// puis verrouillé en cours de jeu (toggleExtension ignore hors phase 'setup').
export default function ExtensionsChecklist() {
  const extensions = useGameStore((s) => s.extensions);
  const toggleExtension = useGameStore((s) => s.toggleExtension);

  return (
    <div>
      <div className="field-label" style={{ marginBottom: 8 }}>🧩 Extensions de jeu</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {EXTENSIONS.map((ext) => {
          const on = extOn(extensions, ext.id);
          return (
            <div
              key={ext.id}
              onClick={() => toggleExtension(ext.id)}
              className="flex items-start gap-2.5 cursor-pointer select-none"
              style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid ${on ? 'var(--gold-600)' : 'rgba(122,94,58,0.18)'}`, background: on ? 'rgba(232,169,88,0.08)' : 'transparent' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(232, 169, 88, 0.14)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = on ? 'rgba(232,169,88,0.08)' : 'transparent')}
            >
              <div
                style={{
                  width: 20, height: 20, borderRadius: 6,
                  background: on ? 'var(--gold-600)' : '#fffefb',
                  border: `2px solid ${on ? 'var(--gold-700)' : 'var(--ink-400)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 14, flexShrink: 0, marginTop: 1,
                }}
              >
                {on ? '✓' : ''}
              </div>
              <div className="min-w-0">
                <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{ext.icon}</span>{ext.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.35, marginTop: 2 }}>
                  {ext.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
