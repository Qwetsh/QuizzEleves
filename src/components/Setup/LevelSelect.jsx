import { useGameStore } from '../../store/gameStore';
import { countQuestions } from '../../data/questions/index.js';
import { useT } from '../../i18n';

const LEVELS = [
  { key: '6e', label: '6\u1d49', sub: null },
  { key: 'cycle4', label: 'Cycle 4', sub: '5e+4e+3e' },
  { key: '5e', label: '5\u1d49', sub: null },
  { key: '4e', label: '4\u1d49', sub: null },
  { key: '3e', label: '3\u1d49', sub: null },
];

export default function LevelSelect() {
  const T = useT();
  const level = useGameStore((s) => s.level);
  const toggleLevel = useGameStore((s) => s.toggleLevel);
  const useBrevet = useGameStore((s) => s.useBrevet);
  const setUseBrevet = useGameStore((s) => s.setUseBrevet);
  // `level` est un tableau (sélection multiple) ; tolère une vieille valeur chaîne.
  const selected = Array.isArray(level) ? level : [level];
  const isOn = (key) => selected.includes(key);
  // Re-render quand les questions sont (re)charg\u00e9es depuis Supabase : les
  // compteurs ci-dessous sont alors recalcul\u00e9s sur la source \u00e0 jour.
  useGameStore((s) => s.questionsVersion);

  // Nombre de questions qu'ajoute le pool Brevet (ind\u00e9pendant du niveau)
  const BREVET_COUNT = countQuestions('3e', { brevet: true }) - countQuestions('3e');

  return (
    <div>
      <div className="field-label">{T('setup.levelLabel')} <span style={{ fontWeight: 400, color: 'var(--ink-400)', fontSize: 12 }}>{T('setup.levelHint')}</span></div>
      <div className="flex gap-2.5 flex-wrap items-stretch">
        {LEVELS.map((l) => {
          const count = countQuestions(l.key);
          return (
            <button
              key={l.key}
              onClick={() => toggleLevel(l.key)}
              className={`chip ${isOn(l.key) ? 'is-active' : ''}`}
            >
              <span className="flex flex-col items-center">
                <strong style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{l.label}</strong>
                <small style={{ fontSize: 12, color: 'var(--ink-500)', fontWeight: 400 }}>
                  {l.sub || T('setup.questionsCount', { n: count })}
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
          title={T('setup.brevetTooltip')}
        >
          <span className="flex flex-col items-center">
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>
              {useBrevet ? '\u2713 ' : '+ '}{T('setup.brevet')}
            </strong>
            <small style={{ fontSize: 12, color: 'var(--ink-500)', fontWeight: 400 }}>
              {T('setup.brevetCount', { n: BREVET_COUNT })}
            </small>
          </span>
        </button>
      </div>
    </div>
  );
}
