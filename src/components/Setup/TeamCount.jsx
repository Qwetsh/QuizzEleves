import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';

const FONT_MONO = "'VT323', monospace";

// Compteur d'équipes façon façade de console : rangée de touches physiques
// 2→6, la touche active s'allume en LED verte (harmonisé SelectionCassettes).
export default function TeamCount() {
  const T = useT();
  const nbTeams = useGameStore((s) => s.nbTeams);
  const setNbTeams = useGameStore((s) => s.setNbTeams);

  return (
    <div className="mb-4">
      <div style={{ fontFamily: FONT_MONO, fontSize: 16, letterSpacing: 2, color: '#5a4023', textTransform: 'uppercase', marginBottom: 8 }}>
        {T('setup.teamsInPlay', { n: nbTeams })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[2, 3, 4, 5, 6].map((n) => {
          const sel = n === nbTeams;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={sel}
              onClick={() => setNbTeams(n)}
              style={{
                width: 54, height: 44, borderRadius: 8, cursor: 'pointer',
                fontFamily: FONT_MONO, fontSize: 26, lineHeight: 1,
                border: '3px solid ' + (sel ? '#57c84d' : '#150f08'),
                background: sel ? '#16331a' : '#2a2117',
                color: sel ? '#9be88f' : '#e3d0aa',
                boxShadow: sel
                  ? '0 0 12px rgba(87,200,77,.4), inset 0 2px 0 rgba(255,255,255,.1)'
                  : '0 3px 0 rgba(21,15,8,.4), inset 0 -3px 0 rgba(0,0,0,.4)',
                transition: 'all 120ms ease',
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
