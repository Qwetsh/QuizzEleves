import { useGameStore } from '../../store/gameStore';
import { countQuestions } from '../../data/questions/index.js';

const LEVELS = [
  { key: 'cycle4', label: 'Cycle 4', sub: '5e+4e+3e' },
  { key: '5e', label: '5\u1d49', sub: null },
  { key: '4e', label: '4\u1d49', sub: null },
  { key: '3e', label: '3\u1d49', sub: null },
];

export default function LevelSelect() {
  const level = useGameStore((s) => s.level);
  const setLevel = useGameStore((s) => s.setLevel);

  return (
    <div>
      <div className="field-label">Niveau</div>
      <div className="flex gap-2.5 flex-wrap">
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
      </div>
    </div>
  );
}
