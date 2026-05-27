import { useGameStore } from '../../store/gameStore';
import { countQuestions } from '../../data/questions/index.js';

const LEVELS = [
  { key: 'cycle4', label: 'Cycle 4 (5e+4e+3e)', desc: '480 questions' },
  { key: '5e', label: '5\u1d49', desc: null },
  { key: '4e', label: '4\u1d49', desc: null },
  { key: '3e', label: '3\u1d49', desc: null },
];

export default function LevelSelect() {
  const level = useGameStore((s) => s.level);
  const setLevel = useGameStore((s) => s.setLevel);

  return (
    <div className="mb-6">
      <label className="block text-sm font-semibold mb-2 text-[var(--muted)]">
        Niveau
      </label>
      <div className="flex gap-2 flex-wrap">
        {LEVELS.map((l) => {
          const count = countQuestions(l.key);
          return (
            <button
              key={l.key}
              onClick={() => setLevel(l.key)}
              className={`px-4 py-2 rounded-lg border-2 font-semibold transition text-sm ${
                level === l.key
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-[var(--border)] bg-white text-[var(--ink)] hover:border-blue-300'
              }`}
            >
              {l.label}
              <span className="block text-xs font-normal opacity-70">
                {count} questions
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
