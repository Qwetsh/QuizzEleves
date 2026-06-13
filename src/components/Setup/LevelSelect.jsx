import { useGameStore } from '../../store/gameStore';
import { countQuestions } from '../../data/questions/index.js';

const LEVELS = [
  { key: 'cycle4', label: 'Cycle 4', sub: '5e+4e+3e' },
  { key: '5e', label: '5\u1d49', sub: null },
  { key: '4e', label: '4\u1d49', sub: null },
  { key: '3e', label: '3\u1d49', sub: null },
];

// Nombre de questions qu'ajoute le pool Brevet (constant, ind\u00e9pendant du niveau)
const BREVET_COUNT = countQuestions('3e', { brevet: true }) - countQuestions('3e');

export default function LevelSelect() {
  const level = useGameStore((s) => s.level);
  const setLevel = useGameStore((s) => s.setLevel);
  const useBrevet = useGameStore((s) => s.useBrevet);
  const setUseBrevet = useGameStore((s) => s.setUseBrevet);

  return (
    <div>
      <div className="field-label">Niveau</div>
      <div className="flex gap-2.5 flex-wrap items-stretch">
        {LEVELS.map((l) => {
          const count = countQuestions(l.key);
          return (
            <button
              key={l.key}
              onClick={() => setLevel(l.key)}
              className={`chip ${level === l.key ? 'is-active' : ''}`}
            >
              <span className="flex flex-col items-center">
                <strong style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{l.label}</strong>
                <small style={{ fontSize: 12, color: 'var(--ink-500)', fontWeight: 400 }}>
                  {l.sub || `${count} questions`}
                </small>
              </span>
            </button>
          );
        })}

        {/* S\u00e9parateur + toggle additif Brevet */}
        <span aria-hidden style={{ width: 1, background: 'rgba(122,94,58,0.22)', margin: '2px 4px' }} />
        <button
          onClick={() => setUseBrevet(!useBrevet)}
          className={`chip ${useBrevet ? 'is-active' : ''}`}
          aria-pressed={useBrevet}
          title="Ajoute les questions \u00ab sp\u00e9cial Brevet \u00bb (DNB) au niveau choisi"
        >
          <span className="flex flex-col items-center">
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>
              {useBrevet ? '\u2713 ' : '+ '}Brevet
            </strong>
            <small style={{ fontSize: 12, color: 'var(--ink-500)', fontWeight: 400 }}>
              +{BREVET_COUNT} questions DNB
            </small>
          </span>
        </button>
      </div>
    </div>
  );
}
